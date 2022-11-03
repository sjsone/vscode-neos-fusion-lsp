import { AbstractNode } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/AbstractNode'
import { TextDocumentPositionParams } from 'vscode-languageserver/node'
import { LanguageServer } from '../LanguageServer'
import { Logger } from '../Logging'
import { CapabilityContext } from './CapabilityContext'

export abstract class AbstractCapability extends Logger {
	protected languageServer: LanguageServer

	constructor(languageServer: LanguageServer) {
		super()
		this.languageServer = languageServer
	}

	public execute(params) {
		try {
			const context = this.buildContextFromParams(params)
			if (!context) return null
			return this.run(context)
		} catch (error) {
			if (error instanceof Error) this.logInfo("Caught Error: ", error.name, error.message, error.stack)
			return null
		}
	}

	protected abstract run<N extends AbstractNode>(capabilityContext: CapabilityContext<N>): any

	protected buildContextFromParams(params: TextDocumentPositionParams): CapabilityContext<any> {
		const uri = params.textDocument.uri
		const line = params.position.line
		const column = params.position.character

		this.logDebug(`${line}/${column} ${params.textDocument.uri}`)

		const workspace = this.languageServer.getWorspaceFromFileUri(uri)
		if (workspace === undefined) return null

		const parsedFile = workspace.getParsedFileByUri(uri)
		if (parsedFile === undefined) return null

		const foundNodeByLine = parsedFile.getNodeByLineAndColumn(line, column)
		if (foundNodeByLine === undefined) return null

		return {
			workspace,
			parsedFile,
			foundNodeByLine,
			params
		}
	}
}