import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { LanguageServer } from '../LanguageServer'
import { TextDocumentPositionParams } from 'vscode-languageserver'


export interface ElementContext<Params, Node extends AbstractNode> {
	workspace: FusionWorkspace
	parsedFile?: ParsedFusionFile
	foundNodeByLine?: LinePositionedNode<Node>,
	params: Params
}
export namespace ElementContext {
	export const createFromParams = <Params extends TextDocumentPositionParams>(languageServer: LanguageServer, params: Params): null | ElementContext<Params, AbstractNode> => {
		if (!('textDocument' in params)) {
			return null
		}

		const uri = params.textDocument.uri

		const workspace = languageServer.getWorkspaceForFileUri(uri)
		if (workspace === undefined) {
			// this.logDebug(`Could not find workspace for URI: ${uri}`)
			return null
		}

		const parsedFile = workspace.getParsedFileByUri(uri)
		if (parsedFile === undefined) {
			// this.logError(`Could not find File for URI: ${uri}`)
			return null
		}

		const context: ElementContext<Params, AbstractNode> = {
			workspace,
			parsedFile,
			params
		}

		if ("position" in params) {
			const line = params.position.line
			const column = params.position.character

			// this.logDebug(`${line}/${column} ${params.textDocument.uri}`)

			const foundNodeByLine = parsedFile.getNodeByLineAndColumn(line, column)
			if (foundNodeByLine === undefined) {
				// this.logDebug(`Could not find node for line/column: ${line}/${column}`)
				return null
			}

			context.foundNodeByLine = foundNodeByLine
		}


		return context
	}
}
