import { ExtensionConfiguration } from '../ExtensionConfiguration';
import { GenericClient } from './GenericClient';
import * as NodePath from "path"
import * as NodeFs from "fs"
import { Logger } from '../common/Logging';
import { InitializeParams, MessageType } from 'vscode-languageserver';
import { uriToPath } from '../common/util';

class ConfigurationFileError extends Error {
	public title!: string
}

class ConfigurationFileNotExistingError extends ConfigurationFileError {
	constructor(configurationFileName: string) {
		super(`Configuration file ${configurationFileName} does not exist.\nRefer the documentation to create one.`)
		this.title = "Configuration File Missing"
	}
}

class ConfigurationFileInvalidJsonError extends ConfigurationFileError {
	constructor(configurationFileName: string) {
		super(`Configuration file ${configurationFileName} seems to not be a valid JSON file.`)
		this.title = "Configuration File Invalid"
	}
}

const fileLoggingBackend = (loggingFilePath: string) => (level: string, name: string, ...things: any[]) => {
	NodeFs.appendFileSync(loggingFilePath, `[${level.padStart(7, " ")}] <${(new Date()).toISOString()}> [${name}] ` + (things[0] ?? ""))
}

export class IntelliJClient extends GenericClient {
	protected workspaceFolderPath: string = ""



	onInitialize(params: InitializeParams): void {
		if (!params.workspaceFolders) {
			this.languageServer.showMessage("No `workspaceFolders` in InitializeParams", MessageType.Error)
			return
		}
		const firstWorkspaceFolder = params.workspaceFolders[0]
		if (!firstWorkspaceFolder) {
			this.languageServer.showMessage("No Workspace in `workspaceFolders`", MessageType.Error)
			return
		}
		this.workspaceFolderPath = uriToPath(firstWorkspaceFolder.uri)

		// this.languageServer.showMessage("Debug: " + NodePath.join(this.workspaceFolderPath ?? "none", ".fusion_ls.json"))

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
		this.logInfo(`onDidChangeConfiguration does nothing as configuration gets loaded from file`)
	}

	getInfo(): string {
		return "IntelliJ Client"
	}

	protected reconfigureLogger(): void {
		const loggingFilePath = NodePath.join(this.workspaceFolderPath ?? "", ".fusion_ls.log")
		const loggingBackend = fileLoggingBackend(loggingFilePath)
		Logger.SetLoggingBackend(loggingBackend)
	}

	protected readConfigurationFromFile(): ExtensionConfiguration {

		const configurationFilePath = NodePath.join(this.workspaceFolderPath ?? "", ".fusion_ls.json")
		if (!NodeFs.existsSync(configurationFilePath)) throw new ConfigurationFileNotExistingError(configurationFilePath)
		try {
			return <ExtensionConfiguration>JSON.parse(NodeFs.readFileSync(configurationFilePath).toString())
		} catch (error) {
			throw new ConfigurationFileInvalidJsonError(configurationFilePath)
		}
	}
}