import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    CompletionItem,
    TextDocumentPositionParams,
    HoverParams,
    Hover,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { LanguageServer } from './LanguageServer';

export interface FusionDocument extends TextDocument { }

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<FusionDocument> = new TextDocuments(TextDocument);

const languageserver = new LanguageServer(connection, documents)


documents.onDidChangeContent(change => {
    languageserver.onDidChangeContent(change)
});

documents.onDidOpen((event) => {
    languageserver.onDidOpen(event)
});

connection.onInitialize((params) => {
    return <any>languageserver.onInitialize(params)
});

connection.onDidChangeWatchedFiles((_change) => {
    connection.console.log("We received a file change event");
});

connection.onDidChangeConfiguration((params) => {
    languageserver.onDidChangeConfiguration(params)
})

connection.onDefinition((params) => {
    return languageserver.getCapability("onDefinition").run(params)
});

connection.onReferences(params => {
    return languageserver.getCapability("onReferences").run(params)
})

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    return languageserver.getCapability("onCompletion").run(textDocumentPosition)
});

connection.onHover((params: HoverParams): Hover => {
    return languageserver.getCapability("onHover").run(params)
})

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {

    // item.detail = fusionPrototype.occourences[0]
    return item;
});

documents.listen(connection);

connection.listen();
