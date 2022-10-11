import {
	TextDocuments,
	TextDocumentSyncKind,
	DidChangeConfigurationParams,
	InitializeParams,
	TextDocumentChangeEvent,
	_Connection,
	InitializeResult,
} from "vscode-languageserver/node";
import { FusionWorkspace } from './FusionWorkspace';
import { type ExtensionConfiguration } from './ExtensionConfiguration';
import { FusionDocument } from './main';
import { AbstractCapability } from './capabilities/AbstractCapability';
import { DefinitionCapability } from './capabilities/DefinitionCapability';
import { CompletionCapability } from './capabilities/CompletionCapability';
import { HoverCapability } from './capabilities/HoverCapability';
import { ReferenceCapability } from './capabilities/ReferenceCapability';
import { uriToPath } from './util';

export class LanguageServer {

	protected connection: _Connection<any>
	protected documents: TextDocuments<FusionDocument>
	protected fusionWorkspaces: FusionWorkspace[] = []
	protected capabilities: Map<string, AbstractCapability> = new Map()

	constructor(connection: _Connection<any>, documents: TextDocuments<FusionDocument>) {
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

	public log(text: string) {
		this.connection.console.log(`[Server(${process.pid})] ${text}`);
	}

	public onDidChangeContent(change: TextDocumentChangeEvent<FusionDocument>) {
		const workspace = this.getWorspaceFromFileUri(change.document.uri)
		if (workspace === undefined) return null

		workspace.updateFileByChange(change)
		this.log(`Document changed: ${change.document.uri.replace(workspace.getUri(), "")}`);
	}

	public onDidOpen(event: TextDocumentChangeEvent<FusionDocument>) {
		const workspace = this.getWorspaceFromFileUri(event.document.uri)
		if (workspace === undefined) return null

		workspace.updateFileByChange(event)
		this.log(`Document opened: ${event.document.uri.replace(workspace.getUri(), "")}`)
	}

	public onInitialize(params: InitializeParams): InitializeResult<any> {
		for (const workspaceFolder of params.workspaceFolders) {
			const fusionWorkspace = new FusionWorkspace(workspaceFolder.name, workspaceFolder.uri)
			this.fusionWorkspaces.push(fusionWorkspace)
		}

		this.log(`${params.workspaceFolders.map(folder => folder.name + "/" + folder.uri).join(",")}] Started and initialize received`);

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
		};
	}

	public onDidChangeConfiguration(params: DidChangeConfigurationParams) {
		const configuration: ExtensionConfiguration = params.settings.neosFusionLsp

		this.log("params.settings: " + JSON.stringify(configuration))
		for (const fusionWorkspace of this.fusionWorkspaces) {
			fusionWorkspace.init(configuration)
		}
	}
}

