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
	ReferenceParams,
	SignatureHelp,
	SignatureHelpParams,
	SymbolInformation,
	TypeDefinitionParams,
	WorkspaceSymbol,
	WorkspaceSymbolParams
} from 'vscode-languageserver'
import { ElementContext } from './ElementContext'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'


export interface ElementInterface<N extends AbstractNode = AbstractNode> {
	onHover?(context: ElementContext<HoverParams, N>): Promise<Hover | undefined | null>
	onCompletion?(context: ElementContext<CompletionParams, N>): Promise<CompletionItem[] | CompletionList | undefined | null>
	onSignatureHelp?(context: ElementContext<SignatureHelpParams, N>): Promise<SignatureHelp | undefined | null>
	onDeclaration?(context: ElementContext<DeclarationParams, N>): Promise<Declaration | DeclarationLink[] | undefined | null>
	onDefinition?(context: ElementContext<DefinitionParams, N>): Promise<Definition | DefinitionLink[] | undefined | null>
	onTypeDefinition?(context: ElementContext<TypeDefinitionParams, N>): Promise<Definition | DefinitionLink[] | undefined | null>
	onImplementation?(context: ElementContext<ImplementationParams, N>): Promise<Definition | DefinitionLink[] | undefined | null>
	onReferences?(context: ElementContext<ReferenceParams, N>): Promise<Location[] | undefined | null>
	onDocumentHighlight?(context: ElementContext<DocumentHighlightParams, N>): Promise<DocumentHighlight[] | undefined | null>
	onDocumentSymbol?(context: ElementContext<DocumentSymbolParams, N>): Promise<SymbolInformation[] | DocumentSymbol[] | undefined | null>
	onWorkspaceSymbol?(context: ElementContext<WorkspaceSymbolParams, N>): Promise<SymbolInformation[] | WorkspaceSymbol[] | undefined | null>
	onCodeAction?(context: ElementContext<CodeActionParams, N>): Promise<(Command | CodeAction)[] | undefined | null>
	onCodeLens?(context: ElementContext<CodeLensParams, N>): Promise<CodeLens[] | undefined | null>

	diagnose?(parsedFusionFile: ParsedFusionFile): Promise<Diagnostic[] | undefined | null>

}

export type ElementMethod = keyof ElementInterface
