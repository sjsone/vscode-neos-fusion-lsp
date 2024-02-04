import { TextDocument } from "vscode-languageserver-textdocument"
import {
    ProposedFeatures,
    TextDocuments,
    createConnection
} from "vscode-languageserver/node"
import { LanguageServer } from './LanguageServer'
import { DocumentSymbolCapability } from './capabilities/DocumentSymbolCapability'
import { RenameCapability } from './capabilities/RenameCapability'
import { RenamePrepareCapability } from './capabilities/RenamePrepareCapability'
import { InlayHintLanguageFeature } from './languageFeatures/InlayHintLanguageFeature'
import { SemanticTokensLanguageFeature } from './languageFeatures/SemanticTokensLanguageFeature'

export type FusionDocument = TextDocument

// INFO: everything is debounced https://github.com/microsoft/vscode/issues/135453

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<FusionDocument> = new TextDocuments(TextDocument)

const languageserver = new LanguageServer(connection, documents)


connection.onInitialize(params => languageserver.onInitialize(params))
connection.onDidChangeConfiguration(params => { languageserver.onDidChangeConfiguration(params) })

documents.onDidOpen(event => languageserver.onDidOpen(event))
documents.onDidChangeContent(change => languageserver.onDidChangeContent(change))
connection.onDidChangeWatchedFiles(params => { languageserver.onDidChangeWatchedFiles(params) })

connection.onDefinition(params => languageserver.runElements("onDefinition", params))
connection.onReferences(params => languageserver.runElements("onReferences", params))
connection.onCompletion(params => languageserver.runElements("onCompletion", params))
connection.onCompletionResolve(item => item)
connection.onHover(params => languageserver.runElements("onHover", params))
connection.onDocumentSymbol(params => languageserver.runCapability(DocumentSymbolCapability, params))
connection.onWorkspaceSymbol(params => languageserver.runElements("onWorkspaceSymbol", <any>params))
connection.onCodeLens(params => languageserver.runElements("onCodeLens", params))
connection.onPrepareRename(params => languageserver.runCapability(RenamePrepareCapability, params))
connection.onRenameRequest(params => languageserver.runCapability(RenameCapability, params))
connection.onSignatureHelp(params => languageserver.runElements("onSignatureHelp", params))
connection.onCodeAction(params => languageserver.onCodeAction(params))

connection.languages.semanticTokens.on(params => languageserver.runLanguageFeature(SemanticTokensLanguageFeature, params))
connection.languages.inlayHint.on(params => languageserver.runLanguageFeature(InlayHintLanguageFeature, params))



documents.listen(connection)
connection.listen()
