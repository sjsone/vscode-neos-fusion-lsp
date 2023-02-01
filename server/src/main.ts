import {
    createConnection,
    TextDocuments,
    ProposedFeatures
} from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { LanguageServer } from './LanguageServer'
import { CompletionCapability } from './capabilities/CompletionCapability'
import { DefinitionCapability } from './capabilities/DefinitionCapability'
import { DocumentSymbolCapability } from './capabilities/DocumentSymbolCapability'
import { HoverCapability } from './capabilities/HoverCapability'
import { ReferenceCapability } from './capabilities/ReferenceCapability'
import { WorkspaceSymbolCapability } from './capabilities/WorkspaceSymbolCapability'
import { SemanticTokensLanguageFeature } from './languageFeatures/SemanticTokensLanguageFeature'
import { InlayHintLanguageFeature } from './languageFeatures/InlayHintLanguageFeature'

export type FusionDocument = TextDocument

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<FusionDocument> = new TextDocuments(TextDocument)

const languageserver = new LanguageServer(connection, documents)


connection.onInitialize(params => languageserver.onInitialize(params))
connection.onDidChangeConfiguration(params => languageserver.onDidChangeConfiguration(params))

documents.onDidOpen(event => languageserver.onDidOpen(event))
documents.onDidChangeContent(change => languageserver.onDidChangeContent(change))
connection.onDidChangeWatchedFiles(params => languageserver.onDidChangeWatchedFiles(params))


connection.onDefinition(params => languageserver.runCapability(DefinitionCapability, params))
connection.onReferences(params => languageserver.runCapability(ReferenceCapability, params))
connection.onCompletion(params => languageserver.runCapability(CompletionCapability, params))
connection.onCompletionResolve(item => item)
connection.onHover(params => languageserver.runCapability(HoverCapability, params))
connection.onDocumentSymbol(params => languageserver.runCapability(DocumentSymbolCapability, params))
connection.onWorkspaceSymbol(params => languageserver.runCapability(WorkspaceSymbolCapability, params))

connection.languages.semanticTokens.on(params => languageserver.runLanguageFeature(SemanticTokensLanguageFeature, params))
connection.languages.inlayHint.on(params => languageserver.runLanguageFeature(InlayHintLanguageFeature, params))

connection.onCodeAction(params => languageserver.onCodeAction(params))


documents.listen(connection)
connection.listen()
