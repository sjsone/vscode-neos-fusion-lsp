import { InlayHintParams } from 'vscode-languageserver/node'
import { LanguageServer } from '../LanguageServer'
import { Logger } from '../common/Logging'
import { LanguageFeatureContext } from './LanguageFeatureContext'

export abstract class AbstractLanguageFeature extends Logger {
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

	protected abstract run(languageFeatureContext: LanguageFeatureContext): any

	protected buildContextFromParams(params: InlayHintParams): LanguageFeatureContext {
		const uri = params.textDocument.uri

		this.logDebug(` ${params.textDocument.uri}`)

		const workspace = this.languageServer.getWorkspaceForFileUri(uri)
		if (workspace === undefined) return null

		const parsedFile = workspace.getParsedFileByUri(uri)
		if (parsedFile === undefined) return null

		return {
			workspace,
			parsedFile,
			params
		}
	}
}