import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    TextDocumentSyncKind,
    CompletionItem,
    TextDocumentPositionParams,
    Location,
    DefinitionLink,
    CompletionItemKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { FusionWorkspace } from './FusionWorkspace';
import { NodeByLine, ParsedFile } from './ParsedFile';
import { FusionObjectValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/FusionObjectValue';
import { PrototypePathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PrototypePathSegment';

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
        fusionWorkspace.init()
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

    connection.console.log(`GOTO: node type "${foundNodeByLine.node.constructor.name}"`)


    let goToPrototypeName = ''


    // PrototypePathSegment // FusionObjectValue
    if(foundNodeByLine.node instanceof FusionObjectValue) {
        goToPrototypeName = foundNodeByLine.node.value
    } else if (foundNodeByLine.node instanceof PrototypePathSegment) {
        goToPrototypeName = foundNodeByLine.node.identifier
    }

    if(goToPrototypeName !== "") {
        connection.console.log(`GOTO: goToPrototypeName "${goToPrototypeName}"`)
        const locations: DefinitionLink[] = []

        for(const otherParsedFile of workspace.parsedFiles) {
            for(const otherNode of [...otherParsedFile.prototypeCreations, ...otherParsedFile.prototypeOverwrites ]) {
                if(otherNode.node.identifier !== goToPrototypeName) continue
                const targetRange = {
                    start: {line: otherNode.line-1, character: otherNode.startColumn-1},
                    end: {line: otherNode.line-1, character: otherNode.endColumn-1}
                }
                
                locations.push({
                    targetUri: otherParsedFile.uri,
                    targetRange,
                    targetSelectionRange: targetRange,
                    originSelectionRange: {
                        start: {line: foundNodeByLine.line-1, character: foundNodeByLine.startColumn-1},
                        end: {line: foundNodeByLine.line-1, character: foundNodeByLine.endColumn-1}
                    }
                })
            }
        }
        return locations
    }

    return null;
});

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const fusionWorkspace = fusionWorkspaces.find(w => w.isResponsibleForUri(textDocumentPosition.textDocument.uri))
    if(fusionWorkspace === undefined) return []
    const foundNodes = fusionWorkspace.getNodesByType(PrototypePathSegment)

    return foundNodes.reduce((prev, cur) => {
        const completions = cur.nodes.map(node => ({
            label: node.node.identifier,
            kind: CompletionItemKind.Keyword,
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
