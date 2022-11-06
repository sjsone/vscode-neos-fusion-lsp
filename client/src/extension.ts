import * as path from 'path'
import {
	workspace as Workspace, window as Window, ExtensionContext, TextDocument, OutputChannel, WorkspaceFolder, Uri, workspace, StatusBarAlignment, window
} from 'vscode'

import {
	LanguageClient, LanguageClientOptions, ServerOptions, TransportKind
} from 'vscode-languageclient/node'
import { NeosContextStatusBarItem, NeosContextStatusBarItemClass } from './neosContextStatusBarItem'
import { PreferenceService } from './preferenceService'
import { ProgressNotificationService } from './progressNotificationService'
import { StatusItemService } from './statusItemService'

const clients: Map<string, LanguageClient> = new Map()

let _sortedWorkspaceFolders: string[] | undefined
function sortedWorkspaceFolders(): string[] {
	if (_sortedWorkspaceFolders === void 0) {
		_sortedWorkspaceFolders = Workspace.workspaceFolders ? Workspace.workspaceFolders.map(folder => {
			let result = folder.uri.toString()
			if (result.charAt(result.length - 1) !== '/') {
				result = result + '/'
			}
			return result
		}).sort((a, b) => a.length - b.length) : []
	}
	return _sortedWorkspaceFolders
}
Workspace.onDidChangeWorkspaceFolders(() => _sortedWorkspaceFolders = undefined)

function getOuterMostWorkspaceFolder(folder: WorkspaceFolder): WorkspaceFolder {
	const sorted = sortedWorkspaceFolders()
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

export function activate(context: ExtensionContext) {
	const module = context.asAbsolutePath(path.join('server', 'out', 'main.js'))
	const outputChannel: OutputChannel = Window.createOutputChannel('Neos Fusion LSP')

	if (workspace.getConfiguration().get("neosFusionLsp.extensions.modify", false)) {
		const preferenceService = new PreferenceService(outputChannel)

		preferenceService.modify({
			path: "auto-close-tag.activationOnLanguage",
			modifier: (value: string[]) => !value.includes("fusion") ? [...value, "fusion"] : null
		})
	}

	function didOpenTextDocument(document: TextDocument): void {
		if (document.languageId !== 'fusion' || (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled')) return

		const uri = document.uri

		let folder = Workspace.getWorkspaceFolder(uri)
		if (!folder) return

		folder = getOuterMostWorkspaceFolder(folder)

		if (!clients.has(folder.uri.toString())) {
			const debugOptions = { execArgv: ["--nolazy", `--inspect=${6011 + clients.size}`] }
			const serverOptions: ServerOptions = {
				run: { module, transport: TransportKind.ipc, options: {} },
				debug: { module, transport: TransportKind.ipc, options: debugOptions }
			}
			const documentSelector = [{ scheme: 'file', language: 'fusion', pattern: `${folder.uri.fsPath}/**/*` }]
			const clientOptions: LanguageClientOptions = {
				documentSelector,
				diagnosticCollectionName: 'vscode-neos-fusion-lsp',
				workspaceFolder: folder,
				outputChannel: outputChannel,
				synchronize: {
					configurationSection: 'neosFusionLsp',
					fileEvents: workspace.createFileSystemWatcher('**/*.php')
				}
			}

			const statusItemService = new StatusItemService(documentSelector)
			const progressNotificationService = new ProgressNotificationService()
			const client = new LanguageClient('vscode-neos-fusion-lsp', 'LSP For Neos Fusion (and AFX)', serverOptions, clientOptions)

			client.onNotification('custom/busy/create', ({ id, configuration }) => statusItemService.createStatusItem(id, configuration))
			client.onNotification('custom/progressNotification/create', ({ id, title }) => progressNotificationService.create(id, title))

			client.start()
			clients.set(folder.uri.toString(), client)

			NeosContextStatusBarItem.init(context, client, outputChannel)

			NeosContextStatusBarItem.addListener(NeosContextStatusBarItemClass.ChangedContextEvent, (selectedContextName) => {
				client.sendNotification('custom/flowContext/set', { selectedContextName })
			})
			// 

			client.onNotification('custom/progressNotification/update', ({ id, payload }) => progressNotificationService.update(id, payload))


			client.onNotification('custom/busy/dispose', ({ id }) => statusItemService.disposeStatusItem(id))
			client.onNotification('custom/progressNotification/finish', ({ id }) => progressNotificationService.finish(id))
		}
	}

	Workspace.onDidOpenTextDocument(didOpenTextDocument)
	Workspace.textDocuments.forEach(didOpenTextDocument)
	Workspace.onDidChangeWorkspaceFolders((event) => {
		for (const folder of event.removed) {
			const client = clients.get(folder.uri.toString())
			if (client) {
				clients.delete(folder.uri.toString())
				client.stop()
			}
		}
	})
}

export function deactivate(): Thenable<void> {
	const promises: Thenable<void>[] = []

	for (const client of clients.values()) {
		promises.push(client.stop())
	}
	return Promise.all(promises).then(() => undefined)
}