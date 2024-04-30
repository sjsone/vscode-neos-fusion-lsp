import { CodeAction, CodeActionParams } from 'vscode-languageserver'
import {
	DidChangeConfigurationParams,
	DidChangeWatchedFilesParams,
	FileChangeType,
	InitializeParams,
	InitializeResult,
	MessageType,
	PublishDiagnosticsParams,
	TextDocumentChangeEvent,
	TextDocumentSyncKind,
	TextDocuments,
	_Connection,
	MessageActionItem
} from "vscode-languageserver/node"
import { type ExtensionConfiguration } from './ExtensionConfiguration'
import { addFusionIgnoreSemanticCommentAction } from './actions/AddFusionIgnoreSemanticCommentAction'
import { addFusionNoAutoincludeNeededSemanticCommentAction } from './actions/AddFusionNoAutoincludeNeededSemanticCommentAction'
import { createNodeTypeFileAction } from './actions/CreateNodeTypeFileAction'
import { openDocumentationAction } from './actions/OpenDocumentationAction'
import { replaceDeprecatedQuickFixAction } from './actions/ReplaceDeprecatedQuickFixAction'
import { AbstractCapability } from './capabilities/AbstractCapability'
import { CodeLensCapability } from './capabilities/CodeLensCapability'
import { CompletionCapability } from './capabilities/CompletionCapability'
import { DefinitionCapability } from './capabilities/DefinitionCapability'
import { DocumentSymbolCapability } from './capabilities/DocumentSymbolCapability'
import { HoverCapability } from './capabilities/HoverCapability'
import { ReferenceCapability } from './capabilities/ReferenceCapability'
import { RenameCapability } from './capabilities/RenameCapability'
import { RenamePrepareCapability } from './capabilities/RenamePrepareCapability'
import { WorkspaceSymbolCapability } from './capabilities/WorkspaceSymbolCapability'
import { AbstractFunctionality } from './common/AbstractFunctionality'
import { ClientCapabilityService } from './common/ClientCapabilityService'
import { LogService, Logger } from './common/Logging'
import { clearLineDataCache, uriToPath } from './common/util'
import { AbstractFileChangeHandler } from './fileChangeHandler/AbstractFileChangeHandler'
import { FusionFileChangeHandler } from './fileChangeHandler/FusionFileChangeHandler'
import { PhpFileChangeHandler } from './fileChangeHandler/PhpFileChangeHandler'
import { XlfFileChangeHandler } from './fileChangeHandler/XlfFileChangeHandler'
import { YamlFileChangeHandler } from './fileChangeHandler/YamlFileChangeHandler'
import { FusionWorkspace } from './fusion/FusionWorkspace'
import { AbstractLanguageFeature } from './languageFeatures/AbstractLanguageFeature'
import { InlayHintLanguageFeature } from './languageFeatures/InlayHintLanguageFeature'
import { SemanticTokensLanguageFeature } from './languageFeatures/SemanticTokensLanguageFeature'
import { FusionDocument } from './main'
import { AbstractLanguageFeatureParams } from './languageFeatures/LanguageFeatureContext'
import { SignatureHelpCapability } from './capabilities/SignatureHelpCapability'


const CodeActions = [
	addFusionIgnoreSemanticCommentAction,
	addFusionNoAutoincludeNeededSemanticCommentAction,
	replaceDeprecatedQuickFixAction,
	openDocumentationAction,
	createNodeTypeFileAction,
]

const FileChangeHandlerTypes: Array<new (...args: any[]) => AbstractFileChangeHandler> = [
	FusionFileChangeHandler,
	PhpFileChangeHandler,
	XlfFileChangeHandler,
	YamlFileChangeHandler
]

export class LanguageServer extends Logger {

	protected connection: _Connection
	protected documents: TextDocuments<FusionDocument>
	public fusionWorkspaces: FusionWorkspace[] = []
	protected clientCapabilityService!: ClientCapabilityService

	protected functionalityInstances: Map<new (...args: any[]) => AbstractFunctionality, AbstractFunctionality> = new Map()
	protected fileChangeHandlerInstances: Map<new (...args: any[]) => AbstractFileChangeHandler, AbstractFileChangeHandler> = new Map()

	constructor(connection: _Connection, documents: TextDocuments<FusionDocument>) {
		super()
		this.connection = connection
		this.documents = documents

		this.addFunctionalityInstance(DefinitionCapability)
		this.addFunctionalityInstance(CompletionCapability)
		this.addFunctionalityInstance(HoverCapability)
		this.addFunctionalityInstance(ReferenceCapability)
		this.addFunctionalityInstance(DocumentSymbolCapability)
		this.addFunctionalityInstance(WorkspaceSymbolCapability)
		this.addFunctionalityInstance(CodeLensCapability)
		this.addFunctionalityInstance(RenamePrepareCapability)
		this.addFunctionalityInstance(RenameCapability)
		this.addFunctionalityInstance(SignatureHelpCapability)

		this.addFunctionalityInstance(InlayHintLanguageFeature)
		this.addFunctionalityInstance(SemanticTokensLanguageFeature)

		this.addFunctionalityInstance(FusionFileChangeHandler)
		this.addFunctionalityInstance(PhpFileChangeHandler)
		this.addFunctionalityInstance(XlfFileChangeHandler)
		this.addFunctionalityInstance(YamlFileChangeHandler)
	}

	protected addFunctionalityInstance(type: new (...args: any[]) => AbstractFunctionality) {
		this.functionalityInstances.set(type, new type(this))
	}

	public getFunctionalityInstance<T extends AbstractFunctionality>(type: new (...args: any[]) => T): T | undefined {
		return <T | undefined>this.functionalityInstances.get(type)
	}

	public runCapability<T extends AbstractCapability>(type: new (...args: any[]) => T, params: any) {
		const capability = this.getFunctionalityInstance<T>(type)
		return capability ? capability.execute(params) : undefined
	}

	public runLanguageFeature<TT extends AbstractLanguageFeatureParams, T extends AbstractLanguageFeature<TT>>(type: new (...args: any[]) => T, params: any) {
		const languageFeature = this.getFunctionalityInstance<T>(type)
		return languageFeature ? languageFeature.execute(params) : undefined
	}

	public getWorkspaceForFileUri = (uri: string): FusionWorkspace | undefined => {
		return this.fusionWorkspaces.find(w => w.isResponsibleForUri(uri))
	}

	public async onDidChangeContent(change: TextDocumentChangeEvent<FusionDocument>) {
		const workspace = this.getWorkspaceForFileUri(change.document.uri)
		if (workspace === undefined) return null

		await workspace.updateFileByChange(change)
		this.logVerbose(`Document changed: ${change.document.uri.replace(workspace.getUri(), "")}`)
	}

	public async onDidOpen(event: TextDocumentChangeEvent<FusionDocument>) {
		const workspace = this.getWorkspaceForFileUri(event.document.uri)
		if (workspace === undefined) return null

		// TODO: Check if new file and if it is add and initialize it
		this.logVerbose(`Document opened: ${event.document.uri.replace(workspace.getUri(), "")}`)
	}

	public onInitialize(params: InitializeParams): InitializeResult {
		this.logVerbose("onInitialize")

		for (const workspaceFolder of params.workspaceFolders ?? []) {
			const fusionWorkspace = new FusionWorkspace(workspaceFolder.name, workspaceFolder.uri, this)
			this.fusionWorkspaces.push(fusionWorkspace)

			this.logInfo(`Added FusionWorkspace ${workspaceFolder.name} with path ${uriToPath(workspaceFolder.uri)}`)
		}

		this.clientCapabilityService = new ClientCapabilityService(params.capabilities)

		return {
			capabilities: {
				inlayHintProvider: true,
				completionProvider: {
					resolveProvider: true,
					triggerCharacters: [`"`, `'`, `/`, `.`, `:`, `@`]
				},
				textDocumentSync: {
					// TODO: Make `params.initializationOptions` optional by defining some kind of default
					openClose: params.initializationOptions.textDocumentSync.openClose,
					change: TextDocumentSyncKind.Full
				},
				codeActionProvider: true,
				definitionProvider: true,
				codeLensProvider: {
					resolveProvider: false
				},
				signatureHelpProvider: {
					triggerCharacters: ["("],
					retriggerCharacters: [","]
				},
				renameProvider: {
					prepareProvider: true
				},
				hoverProvider: true,
				referencesProvider: true,
				documentSymbolProvider: true,
				workspaceSymbolProvider: true,
				semanticTokensProvider: {
					legend: {
						tokenTypes: Array.from(SemanticTokensLanguageFeature.TokenTypes),
						tokenModifiers: Array.from(SemanticTokensLanguageFeature.TokenModifiers)
					},
					range: false,
					full: {
						delta: false
					}
				}
			}
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

	public async onDidChangeConfiguration(params: DidChangeConfigurationParams) {
		const configuration: ExtensionConfiguration = params.settings.neosFusionLsp
		Object.freeze(configuration)

		await this.sendBusyCreate('reload', {
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

		clearLineDataCache()

		await this.sendBusyDispose('reload')
	}

	public async onDidChangeWatchedFiles(params: DidChangeWatchedFilesParams) {
		for (const change of params.changes) {
			this.logVerbose(`Watched: (${Object.keys(FileChangeType)[Object.values(FileChangeType).indexOf(change.type)]}) ${change.uri}`)
			for (const fileChangeHandlerType of FileChangeHandlerTypes) {
				const fileChangeHandler = this.getFunctionalityInstance(fileChangeHandlerType)
				if (fileChangeHandler) await fileChangeHandler.tryToHandle(change)
			}
		}
	}

	public async onCodeAction(params: CodeActionParams) {
		const actions: CodeAction[] = []
		for (const codeAction of CodeActions) {
			try {
				actions.push(...await codeAction(this, params))
			} catch (error) {
				this.logError(`onCodeAction -> ${codeAction.name}():`, error)
			}
		}
		return actions
	}

}

