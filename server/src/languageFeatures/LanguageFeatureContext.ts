import { InlayHintParams } from 'vscode-languageserver/node'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'

export interface LanguageFeatureContext {
	workspace: FusionWorkspace
	parsedFile: ParsedFusionFile
	params: InlayHintParams
}