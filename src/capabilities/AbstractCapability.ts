import { LanguageServer } from '../LanguageServer';

export abstract class AbstractCapability {
	protected languageServer: LanguageServer

	constructor(languageServer: LanguageServer) {
		this.languageServer = languageServer
	}

	public abstract run(...args: any): any

	protected log(text: string) {
		this.languageServer.log(`[${this.constructor.name}]: `+text)
	}
}