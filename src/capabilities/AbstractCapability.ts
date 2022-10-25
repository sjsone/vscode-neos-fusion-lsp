import { LanguageServer } from '../LanguageServer'
import { Logger } from '../Logging'

export abstract class AbstractCapability extends Logger {
	protected languageServer: LanguageServer

	constructor(languageServer: LanguageServer) {
		super()
		this.languageServer = languageServer
	}

	protected buildContextFromUri(uri: string, line: number, column: number) {
		const workspace = this.languageServer.getWorspaceFromFileUri(uri)
		if (workspace === undefined) return null

		const parsedFile = workspace.getParsedFileByUri(uri)
		if (parsedFile === undefined) return null

		const foundNodeByLine = parsedFile.getNodeByLineAndColumn(line, column)
		if (foundNodeByLine === undefined) return null

		return {
			workspace,
			parsedFile,
			foundNodeByLine
		}
	}

	public abstract run(...args: any): any
}