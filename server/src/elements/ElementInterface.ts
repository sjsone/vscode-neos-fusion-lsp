import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import {
	CodeAction,
	CodeActionParams,
	CodeLens,
	CodeLensParams,
	Command,
	CompletionItem,
	CompletionList,
	CompletionParams,
	Declaration,
	DeclarationLink,
	DeclarationParams,
	Definition,
	DefinitionLink,
	DefinitionParams,
	Diagnostic,
	DocumentHighlight,
	DocumentHighlightParams,
	DocumentSymbol,
	DocumentSymbolParams,
	Hover,
	HoverParams,
	ImplementationParams,
	Location,
	PrepareRenameParams,
	Range,
	ReferenceParams,
	RenameParams,
	SignatureHelp,
	SignatureHelpParams,
	SymbolInformation,
	TypeDefinitionParams,
	WorkspaceEdit,
	WorkspaceSymbol,
	WorkspaceSymbolParams
} from 'vscode-languageserver'
import { ElementTextDocumentContext, ElementWorkspacesContext } from './ElementContext'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'


export interface ElementFunctionalityInterface<N extends AbstractNode = AbstractNode> {
	onHover?(context: ElementTextDocumentContext<HoverParams, N>): Promise<Hover | undefined | null>
	onCompletion?(context: ElementTextDocumentContext<CompletionParams, N>): Promise<CompletionItem[] | CompletionList | undefined | null>
	onSignatureHelp?(context: ElementTextDocumentContext<SignatureHelpParams, N>): Promise<SignatureHelp | undefined | null>
	onDeclaration?(context: ElementTextDocumentContext<DeclarationParams, N>): Promise<Declaration | DeclarationLink[] | undefined | null>
	onDefinition?(context: ElementTextDocumentContext<DefinitionParams, N>): Promise<Definition | DefinitionLink[] | undefined | null>
	onTypeDefinition?(context: ElementTextDocumentContext<TypeDefinitionParams, N>): Promise<Definition | DefinitionLink[] | undefined | null>
	onImplementation?(context: ElementTextDocumentContext<ImplementationParams, N>): Promise<Definition | DefinitionLink[] | undefined | null>
	onReferences?(context: ElementTextDocumentContext<ReferenceParams, N>): Promise<Location[] | undefined | null>
	onDocumentHighlight?(context: ElementTextDocumentContext<DocumentHighlightParams, N>): Promise<DocumentHighlight[] | undefined | null>
	onDocumentSymbol?(context: ElementTextDocumentContext<DocumentSymbolParams, N>): Promise<SymbolInformation[] | DocumentSymbol[] | undefined | null>
	onWorkspaceSymbol?(context: ElementWorkspacesContext): Promise<SymbolInformation[] | WorkspaceSymbol[] | undefined | null>
	onCodeAction?(context: ElementTextDocumentContext<CodeActionParams, N>): Promise<(Command | CodeAction)[] | undefined | null>
	onCodeLens?(context: ElementTextDocumentContext<CodeLensParams, N>): Promise<CodeLens[] | undefined | null>
	onRenameRequest?(context: ElementTextDocumentContext<RenameParams, N>): Promise<WorkspaceEdit | undefined | null>
	onPrepareRename?(context: ElementTextDocumentContext<PrepareRenameParams, N>): Promise<Range | {
		range: Range;
		placeholder: string;
	} | {
		defaultBehavior: boolean;
	} | undefined | null>

}

export interface ElementInterface<N extends AbstractNode = AbstractNode> extends ElementFunctionalityInterface {
	isResponsible(methodName: ElementMethod, node: AbstractNode | undefined): boolean


	diagnose?(parsedFusionFile: ParsedFusionFile): Promise<Diagnostic[] | undefined | null>
}

type ParamTypes<T> = T extends (context: ElementTextDocumentContext<infer P, any>) => Promise<infer R> ? P : never;
export type ElementContextParams = ParamTypes<ElementFunctionalityInterface[keyof ElementFunctionalityInterface]>;
export type ElementMethod = keyof ElementFunctionalityInterface
