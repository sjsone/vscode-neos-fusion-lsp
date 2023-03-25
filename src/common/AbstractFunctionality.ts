import { LanguageServer } from '../LanguageServer';
import { Logger } from './Logging';


export class AbstractFunctionality extends Logger {
	protected languageServer: LanguageServer

	constructor(languageServer: LanguageServer) {
		super()
		this.languageServer = languageServer
	}
}