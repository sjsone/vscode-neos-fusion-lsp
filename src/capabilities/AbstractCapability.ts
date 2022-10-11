import { LanguageServer } from '../LanguageServer';

export abstract class AbstractCapability {
	protected languageServer: LanguageServer

	constructor(languageServer: LanguageServer) {
		this.languageServer = languageServer
	}

	public abstract run(...args: any): any
}