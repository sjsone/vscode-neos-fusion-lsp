import * as path from 'path'
import {
	ExtensionContext,
	LanguageStatusItem,
	OutputChannel,
	TextDocument,
	Uri,
	window as Window,
	workspace as Workspace,
	WorkspaceFolder,
	commands, languages,
	workspace
} from 'vscode'

import {
	LanguageClient, LanguageClientOptions, ServerOptions, TransportKind
} from 'vscode-languageclient/node'
import { NeosStatusBarItem, NeosStatusBarItemClass } from './NeosStatusBarItem'
import { PreferenceService } from './PreferenceService'
import { ProgressNotificationService } from './ProgressNotificationService'
import { AbstractCommandConstructor } from './commands/AbstractCommand'
import { InspectCommand } from './commands/InspectCommand'
import { PutContentIntoClipboard } from './commands/PutContentIntoClipboard'
import { ReloadCommand } from './commands/ReloadCommand'
import { ConfigurationTreeProvider, FlowConfigurationTreeModel } from './views/ConfigurationTreeProvider'


export class Extension {
	protected clients: Map<string, LanguageClient> = new Map()
	protected outputChannel: OutputChannel
	protected sortedWorkspaceFolders: string[] | undefined = undefined
	protected context: ExtensionContext | undefined = undefined
	protected flowConfigurationModel = new FlowConfigurationTreeModel

	protected languageStatusBarItems: {
		reload: LanguageStatusItem,
		parsingFusionMergedArrayTree: LanguageStatusItem
	} = { reload: undefined, parsingFusionMergedArrayTree: undefined }

	constructor() {
		this.outputChannel = Window.createOutputChannel('Neos Fusion LSP')

		Workspace.onDidChangeWorkspaceFolders(() => this.sortedWorkspaceFolders = undefined)

		this.createLanguageStatusItems()
	}

	protected createLanguageStatusItems() {
		const documentSelector = { scheme: 'file', language: 'fusion' }
		this.languageStatusBarItems.reload = languages.createLanguageStatusItem("fusion.reload", documentSelector)
		this.languageStatusBarItems.reload.name = "reload"
		this.languageStatusBarItems.reload.text = "Reload Fusion language server"
		this.languageStatusBarItems.reload.command = {
			title: "reload",
			command: "neos-fusion-lsp.reload",
			tooltip: "Reload the Fusion Language Server"
		}
		this.languageStatusBarItems.parsingFusionMergedArrayTree = languages.createLanguageStatusItem("fusion.parsingFusionMergedArrayTree", documentSelector)

		this.languageStatusBarItems.parsingFusionMergedArrayTree.text = "$(beaker)"
		this.languageStatusBarItems.parsingFusionMergedArrayTree.detail = "parsing fusion"
		this.languageStatusBarItems.parsingFusionMergedArrayTree.name = "parsing"
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
		this.registerCommand(ReloadCommand)
		this.registerCommand(PutContentIntoClipboard)

		Window.createTreeView('neosConfiguration', {
			treeDataProvider: new ConfigurationTreeProvider(this.flowConfigurationModel),
		});
	}

	protected onDidOpenTextDocument(document: TextDocument) {
		if (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled') return

		const uri = document.uri
		const folder = Workspace.getWorkspaceFolder(uri)
		if (!folder) return

		const outerMostWorkspaceFolder = this.getOuterMostWorkspaceFolder(folder)
		if (this.clients.has(outerMostWorkspaceFolder.uri.toString())) return

		const startClientInInspectMode = workspace.getConfiguration().get("neosFusionLsp.logging.inspect", false)
		const startedClient = this.startClient(outerMostWorkspaceFolder, startClientInInspectMode)

		NeosStatusBarItem.init(this.context, startedClient, this.outputChannel)
		NeosStatusBarItem.addListener(NeosStatusBarItemClass.ChangedContextEvent, (selectedContextName) => {
			startedClient.sendNotification('custom/flowContext/set', { selectedContextName })
		})
	}

	protected registerCommand(command: AbstractCommandConstructor) {
		this.context.subscriptions.push(commands.registerCommand(command.Identifier, (...args: any[]) => (new command(this)).callback(...args)));
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
					workspace.createFileSystemWatcher('**/*.yaml'),
					workspace.createFileSystemWatcher('**/*.fusion'),
					workspace.createFileSystemWatcher('**/*.yaml')
				]
			},
			initializationOptions: {
				textDocumentSync: {
					openClose: true
				}
			}
		}

		const progressNotificationService = new ProgressNotificationService()
		const client = new LanguageClient('vscode-neos-fusion-lsp', 'LSP For Neos Fusion (and AFX)', serverOptions, clientOptions)

		client.onNotification('custom/busy/create', ({ id, configuration }) => {
			if (id === "parsingFusionMergedArrayTree") {
				this.languageStatusBarItems.parsingFusionMergedArrayTree.busy = configuration.busy
			} else {
				this.languageStatusBarItems.reload.busy = true
			}
		})

		client.onNotification('custom/progressNotification/create', ({ id, title }) => progressNotificationService.create(id, title))
		client.onNotification('custom/progressNotification/update', ({ id, payload }) => progressNotificationService.update(id, payload))

		client.onNotification('custom/busy/dispose', ({ id }) => {
			if (id === "parsingFusionMergedArrayTree") {
				this.languageStatusBarItems.parsingFusionMergedArrayTree.busy = false
			} else {
				this.languageStatusBarItems.reload.busy = false
			}
		})
		client.onNotification('custom/progressNotification/finish', ({ id }) => progressNotificationService.finish(id))

		client.onNotification('custom/flowConfiguration/update', ({ flowConfiguration }) => this.flowConfigurationModel.updateData(flowConfiguration))

		client.start()
		this.clients.set(folder.uri.toString(), client)

		return client
	}

	public async stopClients() {
		const promises: Thenable<void>[] = []

		for (const client of this.clients.values()) {
			promises.push(client.stop())
		}
		return Promise.all(promises).then(() => undefined)
	}
}