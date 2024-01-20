import { LoggingLevel } from '../ExtensionConfiguration'

class LogService {
	protected logLevel: LoggingLevel = LoggingLevel.Info

	setLogLevel(level: LoggingLevel) {
		this.logLevel = level
	}

	getLogLevel() {
		return this.logLevel
	}

	isLogLevel(level: LoggingLevel) {
		return this.logLevel == level
	}
}
const logServiceInstance = new LogService()
export { logServiceInstance as LogService, LogService as LogServiceClass }

export class Logger {
	private loggerLogName: string
	private loggingEnabled = true

	static LogNameAndLevel = (level: string, name: string, ...things: any[]) => {
		console.log(`[${level.padStart(7, " ")}] <${(new Date()).toISOString()}> [${name}]`, ...things)
	}

	constructor(suffix: string | undefined = undefined) {
		this.loggerLogName = this.constructor.name
		if (suffix) this.loggerLogName += "|" + suffix
	}

	private logLevel(level: string, ...things: any) {
		if (this.loggingEnabled) Logger.LogNameAndLevel(level.toUpperCase().padStart(7, " "), this.loggerLogName, ...things)
	}

	log(...things: any) {
		this.logLevel('log', ...things)
	}

	logInfo(...things: any) {
		this.logLevel(LoggingLevel.Info, ...things)
	}

	logError(...things: any) {
		this.logLevel(LoggingLevel.Error, ...things)
	}

	logVerbose(...things: any) {
		const currentLogLevel = logServiceInstance.getLogLevel()
		if (currentLogLevel === LoggingLevel.Verbose || currentLogLevel === LoggingLevel.Debug) {
			this.logLevel(LoggingLevel.Verbose, ...things)
		}
	}

	logDebug(...things: any) {
		if (logServiceInstance.isLogLevel(LoggingLevel.Debug)) this.logLevel(LoggingLevel.Debug, ...things)
	}
}