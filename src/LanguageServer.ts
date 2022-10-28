import {
	TextDocuments,
	TextDocumentSyncKind,
	DidChangeConfigurationParams,
	InitializeParams,
	TextDocumentChangeEvent,
	_Connection,
	InitializeResult,
	MessageType,
	PublishDiagnosticsParams
} from "vscode-languageserver/node"
import { FusionWorkspace } from './fusion/FusionWorkspace'
import { type ExtensionConfiguration } from './ExtensionConfiguration'
import { FusionDocument } from './main'
import { AbstractCapability } from './capabilities/AbstractCapability'
import { DefinitionCapability } from './capabilities/DefinitionCapability'
import { CompletionCapability } from './capabilities/CompletionCapability'
import { HoverCapability } from './capabilities/HoverCapability'
import { ReferenceCapability } from './capabilities/ReferenceCapability'
import { Logger, LogService } from './Logging'
import { uriToPath } from './util'

export class LanguageServer extends Logger {

	protected connection: _Connection<any>
	protected documents: TextDocuments<FusionDocument>
	protected fusionWorkspaces: FusionWorkspace[] = []
	protected capabilities: Map<string, AbstractCapability> = new Map()

	constructor(connection: _Connection<any>, documents: TextDocuments<FusionDocument>) {
		super()
		this.connection = connection
		this.documents = documents

		this.capabilities.set("onDefinition", new DefinitionCapability(this))
		this.capabilities.set("onCompletion", new CompletionCapability(this))
		this.capabilities.set("onHover", new HoverCapability(this))
		this.capabilities.set("onReferences", new ReferenceCapability(this))

	}

	public getCapability(name: string) {
		return this.capabilities.get(name)
	}

	public getWorspaceFromFileUri = (uri: string): FusionWorkspace | undefined => {
		return this.fusionWorkspaces.find(w => w.isResponsibleForUri(uri))
	}

	public async onDidChangeContent(change: TextDocumentChangeEvent<FusionDocument>) {
		const workspace = this.getWorspaceFromFileUri(change.document.uri)
		if (workspace === undefined) return null

		await workspace.updateFileByChange(change)
		this.logVerbose(`Document changed: ${change.document.uri.replace(workspace.getUri(), "")}`)
	}

	public async onDidOpen(event: TextDocumentChangeEvent<FusionDocument>) {
		const workspace = this.getWorspaceFromFileUri(event.document.uri)
		if (workspace === undefined) return null

		await workspace.updateFileByChange(event)
		this.logVerbose(`Document opened: ${event.document.uri.replace(workspace.getUri(), "")}`)
	}

	public onInitialize(params: InitializeParams): InitializeResult<any> {
		this.logVerbose("onInitialize")

		for (const workspaceFolder of params.workspaceFolders) {
			const fusionWorkspace = new FusionWorkspace(workspaceFolder.name, workspaceFolder.uri, this)
			this.fusionWorkspaces.push(fusionWorkspace)

			this.logInfo(`Added FusionWorkspace ${workspaceFolder.name} with path ${uriToPath(workspaceFolder.uri)}`)
		}

		return {
			capabilities: {
				completionProvider: {
					resolveProvider: true
				},
				textDocumentSync: {
					openClose: true,
					change: TextDocumentSyncKind.Full
				},
				definitionProvider: true,
				hoverProvider: true,
				referencesProvider: true
			},
		}
	}

	public showMessage(message: string, type: MessageType = MessageType.Info) {
		return this.connection.sendNotification("window/showMessage", { type, message })
	}

	public sendBusyCreate(id: string, configuration: undefined | { [key: string]: any } = undefined) {
		return this.connection.sendNotification("custom/busy/create", { id, configuration })
	}

	public sendBusyDispose(id: string) {
		return this.connection.sendNotification("custom/busy/dispose", { id })
	}

	public sendProgressNotificationCreate(id: string, title?: string) {
		return this.connection.sendNotification("custom/progressNotification/create", { id, title })
	}

	public sendProgressNotificationUpdate(id: string, payload: { message?: string, increment?: number }) {
		return this.connection.sendNotification("custom/progressNotification/update", { id, payload })
	}

	public sendProgressNotificationFinish(id: string) {
		return this.connection.sendNotification("custom/progressNotification/finish", { id })
	}

	public sendDiagnostics(params: PublishDiagnosticsParams) {
		return this.connection.sendDiagnostics(params)
	}

	public onDidChangeConfiguration(params: DidChangeConfigurationParams) {
		const configuration: ExtensionConfiguration = params.settings.neosFusionLsp
		this.sendBusyCreate('configuration', {
			busy: true,
			text: "$(rocket)",
			detail: "initializing language server",
			name: "initializing"
		})

		LogService.setLogLevel(configuration.logging.level)

		this.logVerbose("Configuration: " + JSON.stringify(configuration))
		for (const fusionWorkspace of this.fusionWorkspaces) {
			fusionWorkspace.init(configuration)
		}

		this.sendBusyDispose('configuration')
	}
}

