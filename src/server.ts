import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    TextDocumentSyncKind,
    CompletionItem,
    TextDocumentPositionParams,
    DefinitionLink,
    CompletionItemKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { FusionWorkspace } from './FusionWorkspace';
import { FusionObjectValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/FusionObjectValue';
import { PrototypePathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PrototypePathSegment';
import { type ExtensionConfiguration } from './configuration';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
const fusionWorkspaces: FusionWorkspace[] = []

const getWorspaceFromFileUri = (uri: string): FusionWorkspace|undefined => {
    return fusionWorkspaces.find(w => w.isResponsibleForUri(uri))
}

documents.onDidChangeContent(change => {
    const workspace = getWorspaceFromFileUri(change.document.uri)
    if(workspace === undefined) return null

    workspace.updateFileByChange(change)
    // update file
    connection.console.log(
        `[Server(${process.pid})] Document changed: ${change.document.uri}`
    );
});

documents.onDidOpen((event) => {
    const workspace = getWorspaceFromFileUri(event.document.uri)
    if(workspace === undefined) return null

    workspace.updateFileByChange(event)
    // update file
    connection.console.log(
        `[Server(${process.pid})] Document opened: ${event.document.uri}`
    );
});


connection.onInitialize((params) => {
    for (const workspaceFolder of params.workspaceFolders) {
        const fusionWorkspace = new FusionWorkspace(workspaceFolder.name, workspaceFolder.uri)
        fusionWorkspaces.push(fusionWorkspace)
    }

    connection.console.log(
        `[Server(${process.pid}) ${params.workspaceFolders.map(folder => folder.name + "/" + folder.uri).join(",")}] Started and initialize received`
    );

    return {
        capabilities: {
            completionProvider: {
                resolveProvider: true,
            },
            textDocumentSync: {
                openClose: true,
                change: TextDocumentSyncKind.Full,
            },
            definitionProvider: true
        },
    };
});

connection.onDidChangeWatchedFiles((_change) => {
    connection.console.log("We received a file change event");
});

connection.onDidChangeConfiguration((params) => {
    const configuration: ExtensionConfiguration = params.settings.neosFusionLsp

    connection.console.log("params.settings: " + JSON.stringify(configuration))
    for(const fusionWorkspace of fusionWorkspaces) {
        fusionWorkspace.init(configuration)
    }
})

connection.onDefinition((params) => {
    const line = params.position.line + 1
    const column = params.position.character + 1
    connection.console.log(`GOTO: ${line}/${column} ${params.textDocument.uri} ${params.workDoneToken}`);

    const workspace = getWorspaceFromFileUri(params.textDocument.uri)
    if(workspace === undefined) return null

    const parsedFile = workspace.getParsedFileByUri(params.textDocument.uri)
    if (parsedFile === undefined) return null

    const foundNodeByLine = parsedFile.getNodeByLineAndColumn(line, column)
    if(foundNodeByLine === undefined) return null
    const foundNodeByLineBegin = foundNodeByLine.getBegin()
    const foundNodeByLineEnd = foundNodeByLine.getEnd()
    

    connection.console.log(`GOTO: node type "${foundNodeByLine.getNode().constructor.name}"`)

    let goToPrototypeName = ''

    // PrototypePathSegment // FusionObjectValue
    if(foundNodeByLine.getNode() instanceof FusionObjectValue) {
        goToPrototypeName = foundNodeByLine.getNode().value
    } else if (foundNodeByLine.getNode() instanceof PrototypePathSegment) {
        goToPrototypeName = foundNodeByLine.getNode().identifier
    }

    if(goToPrototypeName === "") return null

    connection.console.log(`GOTO: goToPrototypeName "${goToPrototypeName}"`)
    const locations: DefinitionLink[] = []

    for(const otherParsedFile of workspace.parsedFiles) {
        for(const otherNode of [...otherParsedFile.prototypeCreations, ...otherParsedFile.prototypeOverwrites ]) {
            if(otherNode.getNode().identifier !== goToPrototypeName) continue
            const otherNodeBegin = otherNode.getBegin()
            const otherNodeEnd = otherNode.getEnd()

            const targetRange = {
                start: {line: otherNodeBegin.line-1, character: otherNodeBegin.column-1},
                end: {line: otherNodeEnd.line-1, character: otherNodeEnd.column-1}
            }
            
            locations.push({
                targetUri: otherParsedFile.uri,
                targetRange,
                targetSelectionRange: targetRange,
                originSelectionRange: {
                    start: {line: foundNodeByLineBegin.line-1, character: foundNodeByLineBegin.column-1},
                    end: {line: foundNodeByLineEnd.line-1, character: foundNodeByLineEnd.column-1}
                }
            })
        }
    }

    return locations
});

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const fusionWorkspace = fusionWorkspaces.find(w => w.isResponsibleForUri(textDocumentPosition.textDocument.uri))
    if(fusionWorkspace === undefined) return []
    const foundNodes = fusionWorkspace.getNodesByType(PrototypePathSegment)

    return foundNodes.reduce((prev, cur) => {
        const completions = cur.nodes.map(node => ({
            label: node.getNode().identifier,
            kind: CompletionItemKind.Keyword
        }))
        prev.push(...completions)
        return prev
    }, [])
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {


    // item.detail = fusionPrototype.occourences[0]
    return item;
});
documents.listen(connection);

connection.listen();
