import * as path from 'path'
import {
	workspace as Workspace, window as Window, ExtensionContext, TextDocument, OutputChannel, WorkspaceFolder, Uri, workspace, ExtensionMode, commands
} from 'vscode'

import {
	LanguageClient, LanguageClientOptions, ServerOptions, TransportKind
} from 'vscode-languageclient/node'
import { PreferenceService } from './preferenceService'
import { ProgressNotificationService } from './progressNotificationService'
import { StatusItemService } from './statusItemService'

// TODO: Create own extension class 

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

function startClient(context: ExtensionContext, folder: WorkspaceFolder, outputChannel: OutputChannel, inspect: boolean = false) {
	const module = context.asAbsolutePath(path.join('server', 'out', 'main.js'))

	const debugOptions = { execArgv: ["--nolazy", `--inspect-brk=${6011 + clients.size}`] }
	const runOptions = { execArgv: [] }
	if (inspect) {
		runOptions.execArgv.push(`--inspect-brk=${6011 + clients.size}`)
	}
	const serverOptions: ServerOptions = {
		run: { module, transport: TransportKind.ipc, options: runOptions },
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
			fileEvents: [
				workspace.createFileSystemWatcher('**/*.php'),
				workspace.createFileSystemWatcher('**/*.fusion')
			]
		},
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
	clients.set(folder.uri.toString(), client)
}

export function activate(context: ExtensionContext) {
	const outputChannel: OutputChannel = Window.createOutputChannel('Neos Fusion LSP')

	if (workspace.getConfiguration().get("neosFusionLsp.extensions.modify", false)) {
		const preferenceService = new PreferenceService(outputChannel)

		preferenceService.modify({
			path: "auto-close-tag.activationOnLanguage",
			modifier: (value: string[]) => !value.includes("fusion") ? [...value, "fusion"] : null
		})
	}

	const inspectCommandHandler = async (name: string = 'world') => {
		const uris = Array.from(clients.keys())

		await stopClients()

		for (const uri of uris) {
			const folder = Workspace.getWorkspaceFolder(Uri.file(uri.replace("file://", "")))
			if (!folder) continue

			const outerMostWorkspaceFolder = getOuterMostWorkspaceFolder(folder)
			startClient(context, outerMostWorkspaceFolder, outputChannel, true)
		}
	}

	context.subscriptions.push(commands.registerCommand('neos-fusion-lsp.inspect', inspectCommandHandler));

	function didOpenTextDocument(document: TextDocument): void {
		if (document.languageId !== 'fusion' || (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled')) return

		const uri = document.uri
		const folder = Workspace.getWorkspaceFolder(uri)
		if (!folder) return

		const outerMostWorkspaceFolder = getOuterMostWorkspaceFolder(folder)
		if (clients.has(outerMostWorkspaceFolder.uri.toString())) return

		const inspect = workspace.getConfiguration().get("neosFusionLsp.logging.inspect", false)
		startClient(context, outerMostWorkspaceFolder, outputChannel, inspect)
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

function stopClients() {
	const promises: Thenable<void>[] = []

	for (const client of clients.values()) {
		promises.push(client.stop())
	}
	return Promise.all(promises).then(() => undefined)
}

export function deactivate(): Thenable<void> {
	return stopClients()
}