import { LanguageServer } from '../LanguageServer'
import { Logger } from '../Logging'

export abstract class AbstractCapability extends Logger {
	protected languageServer: LanguageServer

	constructor(languageServer: LanguageServer) {
		super()
		this.languageServer = languageServer
	}

	public abstract run(...args: any): any
}