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
	_Connection
} from "vscode-languageserver/node"
import { type ExtensionConfiguration } from './ExtensionConfiguration'
import { addFusionIgnoreSemanticCommentAction } from './actions/AddFusionIgnoreSemanticCommentAction'
import { addFusionNoAutoincludeNeededSemanticCommentAction } from './actions/AddFusionNoAutoincludeNeededSemanticCommentAction'
import { createNodeTypeFileAction } from './actions/CreateNodeTypeFileAction'
import { openDocumentationAction } from './actions/OpenDocumentationAction'
import { replaceDeprecatedQuickFixAction } from './actions/ReplaceDeprecatedQuickFixAction'
import { AbstractFunctionality } from './common/AbstractFunctionality'
import { ClientCapabilityService } from './common/ClientCapabilityService'
import { LogService, Logger } from './common/Logging'
import { clearLineDataCache, uriToPath } from './common/util'
import { AfxTagElement } from './elements/AfxTagElement'
import { CommentElement } from './elements/CommentElement'
import { ControllerActionElement } from './elements/ControllerActionElement'
import { EelElement } from './elements/EelElement'
import { EelHelperElement } from './elements/EelHelperElement'
import { ElementContext } from './elements/ElementContext'
import { ElementHelper } from './elements/ElementHelper'
import { ElementContextParams, ElementInterface, ElementMethod } from './elements/ElementInterface'
import { FlowConfigurationElement } from './elements/FlowConfigurationElement'
import { FqcnElement } from './elements/FqcnElement'
import { FusionPropertyElement } from './elements/FusionPropertyElement'
import { NodeTypeElement } from './elements/NodeTypeElement'
import { PrototypeElement } from './elements/PrototypeElement'
import { ResourceUriElement } from './elements/ResourceUriElement'
import { RoutingElement } from './elements/RoutingElement'
import { TranslationElement } from './elements/TranslationElement'
import { AbstractFileChangeHandler } from './fileChangeHandler/AbstractFileChangeHandler'
import { FusionFileChangeHandler } from './fileChangeHandler/FusionFileChangeHandler'
import { PhpFileChangeHandler } from './fileChangeHandler/PhpFileChangeHandler'
import { XlfFileChangeHandler } from './fileChangeHandler/XlfFileChangeHandler'
import { YamlFileChangeHandler } from './fileChangeHandler/YamlFileChangeHandler'
import { FusionWorkspace } from './fusion/FusionWorkspace'
import { AbstractLanguageFeature } from './languageFeatures/AbstractLanguageFeature'
import { AbstractLanguageFeatureParams } from './languageFeatures/LanguageFeatureContext'
import { SemanticTokensLanguageFeature } from './languageFeatures/SemanticTokensLanguageFeature'
import { FusionDocument } from './main'
import { ParsedYaml } from './neos/FlowConfigurationFile'
import { DocumentSymbolsElement } from './elements/DocumentSymbolsElement'


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

	protected elements: Set<ElementInterface> = new Set()
	protected functionalityInstances: Map<new (...args: any[]) => AbstractFunctionality, AbstractFunctionality> = new Map()
	protected fileChangeHandlerInstances: Map<new (...args: any[]) => AbstractFileChangeHandler, AbstractFileChangeHandler> = new Map()

	constructor(connection: _Connection, documents: TextDocuments<FusionDocument>) {
		super()
		this.connection = connection
		this.documents = documents

		this.addElement(AfxTagElement)
		this.addElement(NodeTypeElement)
		this.addElement(CommentElement)
		this.addElement(ControllerActionElement)
		this.addElement(DocumentSymbolsElement)
		this.addElement(EelElement)
		this.addElement(EelHelperElement)
		this.addElement(FlowConfigurationElement)
		this.addElement(FqcnElement)
		this.addElement(FusionPropertyElement)
		this.addElement(NodeTypeElement)
		this.addElement(PrototypeElement)
		this.addElement(ResourceUriElement)
		this.addElement(RoutingElement)
		this.addElement(TranslationElement)


		this.addFunctionalityInstance(SemanticTokensLanguageFeature)

		this.addFunctionalityInstance(FusionFileChangeHandler)
		this.addFunctionalityInstance(PhpFileChangeHandler)
		this.addFunctionalityInstance(XlfFileChangeHandler)
		this.addFunctionalityInstance(YamlFileChangeHandler)
	}

	public async runElements(method: ElementMethod, params: ElementContextParams): Promise<any> {
		const results: any[] = []

		try {
			const context = ElementContext.createFromParams(this, params)
			if (!context) return null

			const node = "foundNodeByLine" in context ? context.foundNodeByLine?.getNode() : undefined

			for (const element of this.elements) {
				if (!(method in element)) continue
				if (node && !element.isResponsible(method, node)) continue

				const result = await element[method]!(<any>context)
				if (ElementHelper.returnOnFirstResult(method)) return result

				if (Array.isArray(result)) results.push(...result)
				else if (result) results.push(result)
			}
		} catch (error) {
			this.logError(`Error trying to run element ${method}`, error)
		}

		return results
	}

	protected addElement(element: new (...args: any[]) => ElementInterface) {
		this.elements.add(new element())
	}

	protected addFunctionalityInstance(type: new (...args: any[]) => AbstractFunctionality) {
		this.functionalityInstances.set(type, new type(this))
	}

	public getFunctionalityInstance<T extends AbstractFunctionality>(type: new (...args: any[]) => T): T | undefined {
		return <T | undefined>this.functionalityInstances.get(type)
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

		this.connection.onNotification("custom/flowContext/set", ({ selectedContextName }) => {
			this.logInfo(`Setting FusionContext to "${selectedContextName}"`)
			for (const fusionWorkspace of this.fusionWorkspaces) {
				// TODO: make the whole Context/Configuration thing better 
				fusionWorkspace.setSelectedFlowContextName(selectedContextName)
				fusionWorkspace.neosWorkspace.configurationManager.rebuildConfiguration()
				fusionWorkspace.languageServer.sendFlowConfiguration(fusionWorkspace.neosWorkspace.configurationManager['mergedConfiguration'])
			}
		})

		this.connection.onRequest("custom/neosContexts/get", () => {
			const contexts = this.fusionWorkspaces[0].neosWorkspace.configurationManager.getContexts()
			if (!contexts) return

			const selectedContext = this.fusionWorkspaces[0].neosWorkspace.configurationManager.getContextPath()
			return contexts.map(context => ({ context, selected: selectedContext === context }))
		})

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

	public sendFlowConfiguration(flowConfiguration: ParsedYaml) {
		return this.connection.sendNotification("custom/flowConfiguration/update", { flowConfiguration })
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
			name: "initializing",
			severity: 1 // Warning
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

