import * as path from 'path'
import {
	ExtensionContext,
	OutputChannel,
	TextDocument,
	Uri,
	window as Window,
	workspace as Workspace,
	WorkspaceFolder,
	commands,
	workspace
} from 'vscode'

import {
	LanguageClient, LanguageClientOptions, ServerOptions, State, TransportKind
} from 'vscode-languageclient/node'
import { NeosStatusBarItem, NeosStatusBarItemClass } from './NeosStatusBarItem'
import { PreferenceService } from './PreferenceService'
import { ProgressNotificationService } from './ProgressNotificationService'
import { AbstractCommandConstructor } from './commands/AbstractCommand'
import { InspectCommand } from './commands/InspectCommand'
import { PutContentIntoClipboard } from './commands/PutContentIntoClipboard'
import { ReloadCommand } from './commands/ReloadCommand'
import { AbstractLanguageStatusBarItem } from './languageStatusBarItems/AbstractLanguageStatusBarItem'
import { Diagnostics } from './languageStatusBarItems/Diagnostics'
import { Reload } from './languageStatusBarItems/Reload'
import { ConfigurationTreeProvider, FlowConfigurationTreeModel } from './views/ConfigurationTreeProvider'


export class Extension {
	protected clients: Map<string, LanguageClient> = new Map()
	protected outputChannel: OutputChannel
	protected sortedWorkspaceFolders: string[] | undefined = undefined
	protected context: ExtensionContext | undefined = undefined
	protected flowConfigurationModel = new FlowConfigurationTreeModel

	protected languageStatusBarItems: { [name: string]: undefined | AbstractLanguageStatusBarItem } = { reload: undefined }

	constructor() {
		this.outputChannel = Window.createOutputChannel('Neos Fusion LSP')

		Workspace.onDidChangeWorkspaceFolders(() => this.sortedWorkspaceFolders = undefined)

		this.createLanguageStatusItems()
	}

	protected createLanguageStatusItems() {
		for (const itemConstructor of [Reload, Diagnostics]) {
			const statusItem = new itemConstructor()
			this.languageStatusBarItems[statusItem.getName()] = statusItem
		}
	}

	public getClients() {
		return this.clients
	}

	public activate(context: ExtensionContext) {
		this.context = context
		if (workspace.getConfiguration().get("neosFusionLsp.extensions.modify", false)) {
			const preferenceService = new PreferenceService(this.outputChannel)

			const modifier = (activationOnLanguages: string[] | null) => {
				if (!activationOnLanguages) return null
				if (activationOnLanguages.includes("fusion")) return null
				return [...activationOnLanguages, "fusion"]
			}

			preferenceService.modify({
				path: "auto-close-tag.activationOnLanguage",
				modifier
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
		})
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

		NeosStatusBarItem.init(this.context!, startedClient, this.outputChannel)
		NeosStatusBarItem.addListener(NeosStatusBarItemClass.ChangedContextEvent, (selectedContextName) => {
			startedClient.sendNotification('custom/flowContext/set', { selectedContextName })
		})
	}

	protected registerCommand(command: AbstractCommandConstructor) {
		this.context!.subscriptions.push(commands.registerCommand(command.Identifier, (...args: any[]) => (new command(this)).callback(...args)))
	}

	public deactivate() {
		this.context = undefined
		return this.stopClients()
	}

	protected getSortedWorkspaceFolders(): string[] {
		if (this.sortedWorkspaceFolders === void 0) {
			this.sortedWorkspaceFolders = Workspace.workspaceFolders ? Workspace.workspaceFolders.map(folder => {
				let result = folder.uri.toString()
				if (!result.endsWith('/')) result = result + '/'
				return result
			}).sort((a, b) => a.length - b.length) : []
		}
		return this.sortedWorkspaceFolders
	}

	public getOuterMostWorkspaceFolder(folder: WorkspaceFolder): WorkspaceFolder {
		const sorted = this.getSortedWorkspaceFolders()
		for (const element of sorted) {
			let uri = folder.uri.toString()
			if (!uri.endsWith('/')) uri = uri + '/'
			if (uri.startsWith(element)) return Workspace.getWorkspaceFolder(Uri.parse(element))!
		}
		return folder
	}

	public startClient(folder: WorkspaceFolder, inspect = false) {
		const module = this.context!.asAbsolutePath(path.join('server', 'out', 'main.js'))

		const runOptions = { execArgv: [] as string[] }

		if (process.env.SERVER_INSPECT_BREAK) {
			console.log("SERVER_INSPECT_BREAK is set.")
			inspect = true
		}

		console.log("start in inspect", inspect)
		if (inspect) {
			runOptions.execArgv.push(`--inspect-brk=${6111}`)
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
			if (id in this.languageStatusBarItems) {
				this.languageStatusBarItems[id]!.item.busy = true
			}
		})

		client.onNotification('custom/error/rootComposerNotFound', async ({ path }: { path: string }) => {
			const changeSettingAction = { title: "Change setting" }

			const result = await Window.showErrorMessage(
				`No 'composer.json' could be found in ${path}. \nMake sure the correct root path is configured in the extension settings.`,
				...[changeSettingAction]
			);

			if (result === undefined) {
				await this.stopClients()
				Window.showInformationMessage("Stopped Neos Fusion language server")
				return
			}

			if (result === changeSettingAction) commands.executeCommand('workbench.action.openSettings', 'neosFusionLsp.folders.root')
		})

		client.onNotification('custom/progressNotification/create', ({ id, title }) => progressNotificationService.create(id, title))
		client.onNotification('custom/progressNotification/update', ({ id, payload }) => progressNotificationService.update(id, payload))

		client.onNotification('custom/busy/dispose', ({ id }) => {
			if (id in this.languageStatusBarItems) {
				this.languageStatusBarItems[id]!.item.busy = false
			}
		})
		client.onNotification('custom/progressNotification/finish', ({ id }) => progressNotificationService.finish(id))

		client.onNotification('custom/flowConfiguration/update', ({ flowConfiguration }) => this.flowConfigurationModel.updateData(flowConfiguration))

		client.start()
		this.clients.set(folder.uri.toString(), client)

		client.onDidChangeState((event) => {
			if (event.oldState === State.Running && event.newState === State.Stopped) {
				this.stopAllRunningInterfaceItems(progressNotificationService)
			}
		})

		return client
	}

	public async stopClients() {
		const promises: Thenable<void>[] = []

		for (const client of this.clients.values()) {
			promises.push(client.stop())
		}
		return Promise.all(promises).then(() => undefined)
	}

	protected stopAllRunningInterfaceItems(progressNotificationService?: ProgressNotificationService) {
		progressNotificationService?.finishAll()
		for (const id in this.languageStatusBarItems) {
			this.languageStatusBarItems[id]!.item.busy = false
		}
	}
}