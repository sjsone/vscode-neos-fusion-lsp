import * as path from 'path'
import {
	workspace as Workspace, window as Window, ExtensionContext, TextDocument, OutputChannel, WorkspaceFolder, Uri, workspace, commands
} from 'vscode'

import {
	LanguageClient, LanguageClientOptions, ServerOptions, TransportKind
} from 'vscode-languageclient/node'
import { AbstractCommandConstructor } from './commands/AbstractCommand'
import { InspectCommand } from './commands/InspectCommand'
import { PreferenceService } from './PreferenceService'
import { ProgressNotificationService } from './ProgressNotificationService'
import { StatusItemService } from './StatusItemService'



export class Extension {
	protected clients: Map<string, LanguageClient> = new Map()
	protected outputChannel: OutputChannel
	protected sortedWorkspaceFolders: string[] | undefined = undefined
	protected context: ExtensionContext | undefined = undefined

	constructor() {
		this.outputChannel = Window.createOutputChannel('Neos Fusion LSP')

		Workspace.onDidChangeWorkspaceFolders(() => this.sortedWorkspaceFolders = undefined)
	}

	public getClients() {
		return this.clients
	}

	public activate(context: ExtensionContext) {
		this.context = context
		if (workspace.getConfiguration().get("neosFusionLsp.extensions.modify", false)) {
			const preferenceService = new PreferenceService(this.outputChannel)

			preferenceService.modify({
				path: "auto-close-tag.activationOnLanguage",
				modifier: (value: string[]) => !value.includes("fusion") ? [...value, "fusion"] : null
			})
		}

		Workspace.onDidOpenTextDocument((document: TextDocument) => this.onDidOpenTextDocument(document))
		Workspace.textDocuments.forEach((document: TextDocument) => this.onDidOpenTextDocument(document))

		Workspace.onDidChangeWorkspaceFolders((event) => {
			for (const folder of event.removed) {
				const client = this.clients.get(folder.uri.toString())
				if (!client) continue

				this.clients.delete(folder.uri.toString())
				client.stop()
			}
		})

		this.registerCommand(InspectCommand)
	}

	protected onDidOpenTextDocument(document: TextDocument) {
		if (document.languageId !== 'fusion' || (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled')) return

		const uri = document.uri
		const folder = Workspace.getWorkspaceFolder(uri)
		if (!folder) return

		const outerMostWorkspaceFolder = this.getOuterMostWorkspaceFolder(folder)
		if (this.clients.has(outerMostWorkspaceFolder.uri.toString())) return

		const inspect = workspace.getConfiguration().get("neosFusionLsp.logging.inspect", false)

		this.startClient(outerMostWorkspaceFolder, inspect)
	}

	protected registerCommand(command: AbstractCommandConstructor) {
		this.context.subscriptions.push(commands.registerCommand(command.Identifier, (new command(this)).callback));
	}

	public deactivate() {
		this.context = undefined
		return this.stopClients()
	}

	protected getSortedWorkspaceFolders(): string[] {
		if (this.sortedWorkspaceFolders === void 0) {
			this.sortedWorkspaceFolders = Workspace.workspaceFolders ? Workspace.workspaceFolders.map(folder => {
				let result = folder.uri.toString()
				if (result.charAt(result.length - 1) !== '/') {
					result = result + '/'
				}
				return result
			}).sort((a, b) => a.length - b.length) : []
		}
		return this.sortedWorkspaceFolders
	}

	public getOuterMostWorkspaceFolder(folder: WorkspaceFolder): WorkspaceFolder {
		const sorted = this.getSortedWorkspaceFolders()
		for (const element of sorted) {
			let uri = folder.uri.toString()
			if (uri.charAt(uri.length - 1) !== '/') {
				uri = uri + '/'
			}
			if (uri.startsWith(element)) {
				return Workspace.getWorkspaceFolder(Uri.parse(element))!
			}
		}
		return folder
	}

	public startClient(folder: WorkspaceFolder, inspect: boolean = false) {
		const module = this.context.asAbsolutePath(path.join('server', 'out', 'main.js'))

		const runOptions = { execArgv: [] }

		console.log("start in inspect", inspect)
		if (inspect) {
			runOptions.execArgv.push(`--inspect-brk=${6011 + this.clients.size}`)
		}
		const serverOptions: ServerOptions = {
			run: { module, transport: TransportKind.ipc, options: runOptions },
			debug: { module, transport: TransportKind.ipc, options: runOptions }
		}
		const documentSelector = [{ scheme: 'file', language: 'fusion', pattern: `${folder.uri.fsPath}/**/*` }]
		const clientOptions: LanguageClientOptions = {
			documentSelector,
			diagnosticCollectionName: 'vscode-neos-fusion-lsp',
			workspaceFolder: folder,
			outputChannel: this.outputChannel,
			synchronize: {
				configurationSection: 'neosFusionLsp',
				fileEvents: [
					workspace.createFileSystemWatcher('**/*.php'),
					workspace.createFileSystemWatcher('**/*.fusion')
				]
			},
			initializationOptions: {
				textDocumentSync: {
					openClose: true
				}
			}
		}

		const statusItemService = new StatusItemService(documentSelector)
		const progressNotificationService = new ProgressNotificationService()
		const client = new LanguageClient('vscode-neos-fusion-lsp', 'LSP For Neos Fusion (and AFX)', serverOptions, clientOptions)

		client.onNotification('custom/busy/create', ({ id, configuration }) => statusItemService.createStatusItem(id, configuration))
		client.onNotification('custom/progressNotification/create', ({ id, title }) => progressNotificationService.create(id, title))

		client.onNotification('custom/progressNotification/update', ({ id, payload }) => progressNotificationService.update(id, payload))

		client.onNotification('custom/busy/dispose', ({ id }) => statusItemService.disposeStatusItem(id))
		client.onNotification('custom/progressNotification/finish', ({ id }) => progressNotificationService.finish(id))

		client.start()
		this.clients.set(folder.uri.toString(), client)
	}

	public stopClients() {
		const promises: Thenable<void>[] = []

		for (const client of this.clients.values()) {
			promises.push(client.stop())
		}
		return Promise.all(promises).then(() => undefined)
	}
}