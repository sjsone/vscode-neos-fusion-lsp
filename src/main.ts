import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    WorkspaceSymbolParams
} from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { LanguageServer } from './LanguageServer'

export type FusionDocument = TextDocument

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<FusionDocument> = new TextDocuments(TextDocument)

const languageserver = new LanguageServer(connection, documents)


connection.onInitialize(params => languageserver.onInitialize(params))
connection.onDidChangeConfiguration(params => languageserver.onDidChangeConfiguration(params))

documents.onDidOpen(event => languageserver.onDidOpen(event))
documents.onDidChangeContent(change => languageserver.onDidChangeContent(change))
connection.onDidChangeWatchedFiles(params => languageserver.onDidChangeWatchedFiles(params))

connection.onDefinition(params => languageserver.runCapability("onDefinition", params))
connection.onReferences(params => languageserver.runCapability("onReferences", params))
connection.onCompletion(params => languageserver.runCapability("onCompletion", params))
connection.onCompletionResolve(item => item)
connection.onHover(params => languageserver.runCapability("onHover", params))
connection.onDocumentSymbol(params => languageserver.runCapability("onDocumentSymbol", params))
connection.onWorkspaceSymbol(params => languageserver.runCapability("onWorkspaceSymbol", params))

connection.onCodeAction(params => languageserver.onCodeAction(params))

connection.languages.semanticTokens.on(params => languageserver.getLanguageFeature("semanticTokens").execute(params))
connection.languages.inlayHint.on(params => languageserver.getLanguageFeature("inlayHint").execute(params))



documents.listen(connection)
connection.listen()
