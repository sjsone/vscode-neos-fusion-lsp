import {
	TextDocuments,
	TextDocumentSyncKind,
	DidChangeConfigurationParams,
	InitializeParams,
	TextDocumentChangeEvent,
	_Connection,
	InitializeResult,
	MessageType,
	PublishDiagnosticsParams,
	DidChangeWatchedFilesParams,
	FileChangeType
} from "vscode-languageserver/node"
import { FusionWorkspace } from './fusion/FusionWorkspace'
import { type ExtensionConfiguration } from './ExtensionConfiguration'
import { FusionDocument } from './main'
import { AbstractCapability } from './capabilities/AbstractCapability'
import { DefinitionCapability } from './capabilities/DefinitionCapability'
import { CompletionCapability } from './capabilities/CompletionCapability'
import { HoverCapability } from './capabilities/HoverCapability'
import { ReferenceCapability } from './capabilities/ReferenceCapability'
import { Logger, LogService } from './common/Logging'
import { clearLineNumberCache, uriToPath } from './common/util'
import { AbstractLanguageFeature } from './languageFeatures/AbstractLanguageFeature'
import { InlayHintLanguageFeature } from './languageFeatures/InlayHintLanguageFeature'
import { DocumentSymbolCapability } from './capabilities/DocumentSymbolCapability'
import { CodeActionParams } from 'vscode-languageserver';
import { replaceDeprecatedQuickFixAction } from './actions/ReplaceDeprecatedQuickFixAction'
import { WorkspaceSymbolCapability } from './capabilities/WorkspaceSymbolCapability'
import { SemanticTokensLanguageFeature } from './languageFeatures/SemanticTokensLanguageFeature'
import { AbstractFunctionality } from './common/AbstractFunctionality'


export class LanguageServer extends Logger {

	protected connection: _Connection
	protected documents: TextDocuments<FusionDocument>
	protected fusionWorkspaces: FusionWorkspace[] = []

	protected functionalityInstances: Map<new (...args: unknown[]) => AbstractFunctionality, AbstractFunctionality> = new Map()

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

		this.addFunctionalityInstance(InlayHintLanguageFeature)
		this.addFunctionalityInstance(SemanticTokensLanguageFeature)
	}

	protected addFunctionalityInstance(type: new (...args: unknown[]) => AbstractFunctionality) {
		this.functionalityInstances.set(type, new type(this))
	}

	public getFunctionalityInstance<T extends AbstractFunctionality>(type: new (...args: unknown[]) => AbstractFunctionality): T | undefined {
		return <T | undefined>this.functionalityInstances.get(type)
	}

	public runCapability<T extends AbstractCapability>(type: new (...args: unknown[]) => AbstractCapability, params: any) {
		const capability = this.getFunctionalityInstance<T>(type)
		return capability ? capability.execute(params) : undefined
	}

	public runLanguageFeature<T extends AbstractLanguageFeature>(type: new (...args: unknown[]) => AbstractLanguageFeature, params: any) {
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

		await workspace.updateFileByChange(event)
		this.logVerbose(`Document opened: ${event.document.uri.replace(workspace.getUri(), "")}`)
	}

	public onInitialize(params: InitializeParams): InitializeResult {
		this.logVerbose("onInitialize")

		for (const workspaceFolder of params.workspaceFolders) {
			const fusionWorkspace = new FusionWorkspace(workspaceFolder.name, workspaceFolder.uri, this)
			this.fusionWorkspaces.push(fusionWorkspace)

			this.logInfo(`Added FusionWorkspace ${workspaceFolder.name} with path ${uriToPath(workspaceFolder.uri)}`)
		}

		return {
			capabilities: {
				inlayHintProvider: true,
				completionProvider: {
					resolveProvider: true,
					triggerCharacters: [`"`, `'`, `/`, `.`, `:`]
				},
				textDocumentSync: {
					openClose: params.initializationOptions.textDocumentSync.openClose,
					change: TextDocumentSyncKind.Full
				},
				codeActionProvider: true,
				definitionProvider: true,
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

		clearLineNumberCache()

		this.sendBusyDispose('configuration')
	}

	public onDidChangeWatchedFiles(params: DidChangeWatchedFilesParams) {
		// TODO: Create separate Watchers (like capabilities)
		// TODO: Update relevant ParsedFusionFiles  
		for (const change of params.changes) {
			// console.log(`CHANGE: ${change.type} ${change.uri}`)
			this.logVerbose(`Watched: (${Object.keys(FileChangeType)[Object.values(FileChangeType).indexOf(change.type)]}) ${change.uri}`)
			if (change.type === FileChangeType.Changed) {
				if (!change.uri.endsWith(".php")) continue
				for (const workspace of this.fusionWorkspaces) {
					for (const [name, neosPackage] of workspace.neosWorkspace.getPackages().entries()) {
						const helper = neosPackage.getEelHelpers().find(helper => helper.uri === change.uri)
						if (!helper) continue

						this.logVerbose(`  File was EEL-Helper ${helper.name}`)

						const namespace = helper.namespace
						const classDefinition = namespace.getClassDefinitionFromFilePathAndClassName(uriToPath(helper.uri), helper.className, helper.pathParts)

						this.logVerbose(`  Methods: then ${helper.methods.length} now ${classDefinition.methods.length}`)

						helper.methods = classDefinition.methods
						helper.position = classDefinition.position
					}
				}
			}
			if (change.type === FileChangeType.Created) {
				if (!change.uri.endsWith(".fusion")) continue
				const workspace = this.getWorkspaceForFileUri(change.uri)
				if (!workspace) {
					this.logInfo(`Created Fusion file corresponds to no workspace. ${change.uri}`)
					continue
				}
				workspace.addParsedFileFromPath(uriToPath(change.uri))
				this.logDebug(`Added new ParsedFusionFile ${change.uri}`)
			}

			if (change.type === FileChangeType.Deleted) {
				if (!change.uri.endsWith(".fusion")) continue
				const workspace = this.getWorkspaceForFileUri(change.uri)
				if (!workspace) {
					this.logInfo(`Deleted Fusion file corresponds to no workspace. ${change.uri}`)
					continue
				}
				workspace.removeParsedFile(change.uri)
			}
		}
	}

	public onCodeAction(params: CodeActionParams) {
		return replaceDeprecatedQuickFixAction(params)
	}

}

