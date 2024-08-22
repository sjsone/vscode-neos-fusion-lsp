import { TextDocument } from "vscode-languageserver-textdocument"
import {
    ProposedFeatures,
    TextDocuments,
    createConnection
} from "vscode-languageserver/node"
import { LanguageServer } from './LanguageServer'
import { CodeLensCapability } from './capabilities/CodeLensCapability'
import { CompletionCapability } from './capabilities/CompletionCapability'
import { DefinitionCapability } from './capabilities/DefinitionCapability'
import { DocumentSymbolCapability } from './capabilities/DocumentSymbolCapability'
import { HoverCapability } from './capabilities/HoverCapability'
import { ReferenceCapability } from './capabilities/ReferenceCapability'
import { RenameCapability } from './capabilities/RenameCapability'
import { RenamePrepareCapability } from './capabilities/RenamePrepareCapability'
import { WorkspaceSymbolCapability } from './capabilities/WorkspaceSymbolCapability'
import { InlayHintLanguageFeature } from './languageFeatures/InlayHintLanguageFeature'
import { SemanticTokensLanguageFeature } from './languageFeatures/SemanticTokensLanguageFeature'
import { SignatureHelpCapability } from './capabilities/SignatureHelpCapability'
import { GenericClient } from './client/GenericClient'
import { resolveClient } from './ClientBuilding'

export type FusionDocument = TextDocument

// INFO: everything is debounced https://github.com/microsoft/vscode/issues/135453

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<FusionDocument> = new TextDocuments(TextDocument)

const client = resolveClient()
const languageserver = new LanguageServer(connection, documents, client)


connection.onInitialize(params => languageserver.onInitialize(params))
connection.onDidChangeConfiguration(params => { languageserver.onDidChangeConfiguration(params) })

documents.onDidOpen(event => languageserver.onDidOpen(event))
documents.onDidChangeContent(change => languageserver.onDidChangeContent(change))
connection.onDidChangeWatchedFiles(params => { languageserver.onDidChangeWatchedFiles(params) })

connection.onDefinition(params => languageserver.runCapability(DefinitionCapability, params))
connection.onReferences(params => languageserver.runCapability(ReferenceCapability, params))
connection.onCompletion(params => languageserver.runCapability(CompletionCapability, params))
connection.onCompletionResolve(item => item)
connection.onHover(params => languageserver.runCapability(HoverCapability, params))
connection.onDocumentSymbol(params => languageserver.runCapability(DocumentSymbolCapability, params))
connection.onWorkspaceSymbol(params => languageserver.runCapability(WorkspaceSymbolCapability, params))
connection.onCodeLens(params => languageserver.runCapability(CodeLensCapability, params))
connection.onPrepareRename(params => languageserver.runCapability(RenamePrepareCapability, params))
connection.onRenameRequest(params => languageserver.runCapability(RenameCapability, params))
connection.onSignatureHelp(params => languageserver.runCapability(SignatureHelpCapability, params))
connection.onCodeAction(params => languageserver.onCodeAction(params))

connection.languages.semanticTokens.on(params => languageserver.runLanguageFeature(SemanticTokensLanguageFeature, params))
connection.languages.inlayHint.on(params => languageserver.runLanguageFeature(InlayHintLanguageFeature, params))



documents.listen(connection)
connection.listen()
