import { Range, TextDocumentIdentifier } from 'vscode-languageserver/node'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'

export interface LanguageFeatureContext {
	workspace: FusionWorkspace
	parsedFile: ParsedFusionFile
	params: AbstractLanguageFeatureParams
}

export interface AbstractLanguageFeatureParams {
	textDocument: TextDocumentIdentifier;
	range?: Range;
}