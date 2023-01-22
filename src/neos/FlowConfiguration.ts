import * as NodeFs from "fs"
import * as NodePath from "path"
import { parse as parseYaml } from 'yaml'
import { LoggingLevel } from '../ExtensionConfiguration'
import { Logger, LogService } from '../common/Logging'
import { getFiles, mergeObjects } from '../common/util'

export type ParsedYaml = string | null | number | { [key: string]: ParsedYaml }

export class FlowConfiguration extends Logger {
	protected parsedYamlConfiguration: ParsedYaml

	constructor(parsedYamlConfiguration: ParsedYaml) {
		super()
		this.parsedYamlConfiguration = parsedYamlConfiguration
	}

	get<T extends ParsedYaml>(path: string | string[], parsedYamlConfiguration = this.parsedYamlConfiguration): T {
		if (parsedYamlConfiguration === undefined || parsedYamlConfiguration === null) return undefined
		if (!Array.isArray(path)) path = path.split(".")
		const key = path.shift()
		const value = parsedYamlConfiguration[key]
		if (path.length === 0) return value
		if (value === undefined || value === null) return undefined
		return (typeof value === 'object' && typeof value !== 'function') ? this.get(path, value) : undefined
	}

	static FromFolder(folderPath: string) {
		let configuration = {}
		for (const configurationFilePath of getFiles(folderPath, ".yaml")) {
			if (!NodePath.basename(configurationFilePath).startsWith("Settings")) continue
			const configurationFile = NodeFs.readFileSync(configurationFilePath).toString()
			const parsedYaml = parseYaml(configurationFile)

			try {
				const mergedConfiguration = mergeObjects(parsedYaml, configuration)
				configuration = mergedConfiguration ? mergedConfiguration : configuration
				if (LogService.isLogLevel(LoggingLevel.Debug)) {
					Logger.LogNameAndLevel(LoggingLevel.Debug.toUpperCase(), 'FlowConfiguration:FromFolder', 'Read configuration from: ' + configurationFilePath)
				}
			} catch (e) {
				if (e instanceof Error) {
					console.log("ERROR: configuration", configuration)
					console.log("ERROR: ", e.message, e.stack)
				}
			}
		}
		if (LogService.isLogLevel(LoggingLevel.Verbose)) {
			// Logger.LogNameAndLevel(LoggingLevel.Verbose.toUpperCase(), 'FlowConfiguration:FromFolder', 'Created FlowConfiguration from: ' + folderPath)
		}
		return new FlowConfiguration(configuration)
	}
}