import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { TextDocumentPositionParams, WorkspaceSymbolParams } from 'vscode-languageserver/node'
import { CapabilityContext, WorkspacesCapabilityContext } from './CapabilityContext'
import { AbstractFunctionality } from '../common/AbstractFunctionality'

export abstract class AbstractCapability extends AbstractFunctionality {
	protected noPositionedNode = false

	public execute(params: TextDocumentPositionParams | WorkspaceSymbolParams) {
		try {
			const context = this.buildContextFromParams(params)
			if (!context) return null
			return this.run(context)
		} catch (error) {
			if (error instanceof Error) this.logInfo("Caught Error: ", error.name, error.message, error.stack)
			return null
		}
	}

	// TODO: create context with non-undefinable `foundNodeByLine`
	protected abstract run<N extends AbstractNode>(capabilityContext: CapabilityContext<N>): any

	protected buildContextFromParams(params: TextDocumentPositionParams | WorkspaceSymbolParams): null | CapabilityContext<AbstractNode> {
		if (!('textDocument' in params)) {
			return {
				workspaces: this.languageServer.fusionWorkspaces,
				params
			} as WorkspacesCapabilityContext
		}

		const uri = params.textDocument.uri

		const workspace = this.languageServer.getWorkspaceForFileUri(uri)
		if (workspace === undefined) {
			this.logDebug(`Could not find workspace for URI: ${uri}`)
			return null
		}

		const parsedFile = workspace.getParsedFileByUri(uri)
		if (parsedFile === undefined) {
			this.logError(`Could not find File for URI: ${uri}`)
			return null
		}

		const context: CapabilityContext<AbstractNode> = {
			workspace,
			parsedFile,
			params
		}

		if (!this.noPositionedNode) {
			const line = params.position.line
			const column = params.position.character

			this.logDebug(`${line}/${column} ${params.textDocument.uri}`)

			const foundNodeByLine = parsedFile.getNodeByLineAndColumn(line, column)
			if (foundNodeByLine === undefined) {
				this.logDebug(`Could not find node for line/column: ${line}/${column}`)
				return null
			}

			context.foundNodeByLine = foundNodeByLine
		}

		return context
	}
}