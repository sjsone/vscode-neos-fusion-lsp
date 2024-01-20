import { LanguageServer } from '../LanguageServer'
import { Logger } from './Logging'


export class AbstractFunctionality extends Logger {
	constructor(protected languageServer: LanguageServer) {
		super()
	}
}