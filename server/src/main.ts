import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    CompletionItem,
    TextDocumentPositionParams,
    HoverParams,
    Hover,
} from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { LanguageServer } from './LanguageServer'

export type FusionDocument = TextDocument

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<FusionDocument> = new TextDocuments(TextDocument)

const languageserver = new LanguageServer(connection, documents)


documents.onDidChangeContent(change => {
    return languageserver.onDidChangeContent(change)
})

documents.onDidOpen((event) => {
    return languageserver.onDidOpen(event)
})

connection.onInitialize((params) => {
    return languageserver.onInitialize(params)
})

connection.onDidChangeWatchedFiles((params) => {
    // TODO: Updated EEL-Helpers depending on changes
    // for(const change of params.changes) {
    //     connection.console.log(`  ${change.type} ${change.uri}`)
    // }
})

connection.onDidChangeConfiguration((params) => {
    languageserver.onDidChangeConfiguration(params)
})

connection.onDefinition((params) => {
    return languageserver.getCapability("onDefinition").execute(params)
})

connection.onReferences(params => {
    return languageserver.getCapability("onReferences").execute(params)
})

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    return languageserver.getCapability("onCompletion").execute(textDocumentPosition)
})
connection.onCompletionResolve((item: CompletionItem): CompletionItem => item)

connection.onHover((params: HoverParams): Hover => {
    return languageserver.getCapability("onHover").execute(params)
})

connection.languages.inlayHint.on(params => {
    return languageserver.getLanguageFeature("inlayHint").execute(params)
})

documents.listen(connection)
connection.listen()
