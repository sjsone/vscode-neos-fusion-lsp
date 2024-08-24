import { ExtensionConfiguration } from '../ExtensionConfiguration';
import { GenericClient } from './GenericClient';
import * as NodePath from "path"
import * as NodeFs from "fs"

const ConfigurationFileName = ".fusion_ls.json"

class ConfigurationFileError extends Error {
	public title!: string
}

class ConfigurationFileNotExistingError extends ConfigurationFileError {
	constructor() {
		super(`Configuration file ${ConfigurationFileName} does not exist.\nRefer the documentation to create one.`)
		this.title = "Configuration File Missing"
	}
}

class ConfigurationFileInvalidJsonError extends ConfigurationFileError {
	constructor() {
		super(`Configuration file ${ConfigurationFileName} seems to not be a valid JSON file.`)
		this.title = "Configuration File Invalid"
	}
}

export class IntelliJClient extends GenericClient {
	onInitialize(): void {
		try {
			const configuration = this.readConfigurationFromFile()
			this.handleConfigurationAndInitFusionWorkspaces(configuration)
		} catch (error) {
			if (error instanceof ConfigurationFileError) {
				this.languageServer.showMessage(`${error.title}\n\n${error.message}`)
			} else {
				throw error
			}
		}
	}

	async onDidChangeConfiguration() {
		this.logInfo(`onDidChangeConfiguration does nothing as configuration gets loaded from ${ConfigurationFileName}`)
	}

	getInfo(): string {
		return "IntelliJ Client"
	}

	protected readConfigurationFromFile(): ExtensionConfiguration {
		const configurationFilePath = NodePath.resolve(ConfigurationFileName)
		if (!NodeFs.existsSync(configurationFilePath)) throw new ConfigurationFileNotExistingError
		try {
			return <ExtensionConfiguration>JSON.parse(NodeFs.readFileSync(configurationFilePath).toString())
		} catch (error) {
			throw new ConfigurationFileInvalidJsonError
		}
	}
}