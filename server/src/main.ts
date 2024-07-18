import { TextDocument } from "vscode-languageserver-textdocument"
import {
    ProposedFeatures,
    TextDocuments,
    createConnection
} from "vscode-languageserver/node"
import { LanguageServer } from './LanguageServer'
import { SemanticTokensLanguageFeature } from './languageFeatures/SemanticTokensLanguageFeature'
import { SignatureHelpCapability } from './capabilities/SignatureHelpCapability'

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

connection.onDefinition(params => languageserver.elementService.runElements("onDefinition", params))
connection.onReferences(params => languageserver.elementService.runElements("onReferences", params))
connection.onCompletion(params => languageserver.elementService.runElements("onCompletion", params))
connection.onCompletionResolve(item => item)
connection.onHover(params => languageserver.elementService.runElements("onHover", params))
connection.onDocumentSymbol(params => languageserver.elementService.runElements("onDocumentSymbol", params))
connection.onWorkspaceSymbol(params => languageserver.elementService.runElements("onWorkspaceSymbol", <any>params))
connection.onCodeLens(params => languageserver.elementService.runElements("onCodeLens", params))
connection.onPrepareRename(params => languageserver.elementService.runElements("onPrepareRename", params))
connection.onRenameRequest(params => languageserver.elementService.runElements("onRenameRequest", params))
connection.onSignatureHelp(params => languageserver.elementService.runElements("onSignatureHelp", params))
connection.onCodeAction(params => languageserver.onCodeAction(params))

connection.languages.semanticTokens.on(params => languageserver.runLanguageFeature(SemanticTokensLanguageFeature, params))
connection.languages.inlayHint.on(params => languageserver.elementService.runElements("onInlayHint", params))



documents.listen(connection)
connection.listen()
