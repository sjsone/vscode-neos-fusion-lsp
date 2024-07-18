import * as NodeFs from "fs"
import * as NodePath from "path"
import { Range } from 'vscode-languageserver'
import { Logger } from './common/Logging'
import { mergeObjects } from './common/util'
import { FlowConfiguration } from './neos/FlowConfiguration'
import { FlowConfigurationFile, ParsedYaml } from './neos/FlowConfigurationFile'
import { NeosPackage } from './neos/NeosPackage'
import { NeosWorkspace } from './neos/NeosWorkspace'

export interface ConfigurationContext {
	name: string,
	files: string[],
	contexts: { [key: string]: ConfigurationContext }
}

// TODO: Check if ConfigurationManager has to be consolidated with FlowConfigurations 

export class ConfigurationManager extends Logger {
	protected workspace: NeosWorkspace
	protected packagePaths: string[] = []
	protected allContexts?: ConfigurationContext
	protected selectedContextPath?: string = "Development"
	protected configurations: FlowConfiguration[] = []
	protected mergedConfiguration: ParsedYaml = {}

	constructor(workspace: NeosWorkspace) {
		super()
		this.workspace = workspace
	}

	addPackage(neosPackage: NeosPackage, path: string) {
		// this.logInfo(`Adding package ${path}`)
		this.packagePaths.push(path)
		this.addToMergedConfiguration(neosPackage["configuration"]["settingsConfiguration"])
	}

	addToMergedConfiguration(newConfiguration: ParsedYaml) {
		try {
			if (!newConfiguration || typeof newConfiguration !== "object") return
			const mergedConfiguration = <ParsedYaml>mergeObjects(newConfiguration, <{ [key: string]: any; }>this.mergedConfiguration)
			this.mergedConfiguration = mergedConfiguration ?? this.mergedConfiguration
		} catch (error) {
			// console.log(error)
		}
	}

	rebuildConfiguration() {
		this.mergedConfiguration = {}
		for (const configuration of this.configurations) {
			configuration["initialize"]()
			this.addToMergedConfiguration(configuration["settingsConfiguration"])
		}
	}

	buildConfiguration(selectedFlowContextName?: string) {
		const projectConfigurationFolder = this.workspace["fusionWorkspace"].getConfiguration().folders.projectConfiguration
		const globalConfigurationPath = NodePath.join(this.workspace["workspacePath"], projectConfigurationFolder)
		// console.log("globalConfigurationPath", globalConfigurationPath, NodeFs.existsSync(globalConfigurationPath))
		if (!NodeFs.existsSync(globalConfigurationPath)) return

		this.allContexts = this.getConfigurationContexts(globalConfigurationPath, "Configuration")
	}

	getConfigurationContexts(path: string, name: string) {
		const dirEntries = NodeFs.readdirSync(path, { withFileTypes: true })
		const context: ConfigurationContext = {
			name,
			files: [],
			contexts: {}
		}

		for (const entry of dirEntries) {
			if (entry.isSymbolicLink() || entry.name.startsWith(".")) continue
			const entryPath = NodePath.join(path, entry.name)
			if (entry.isFile() && entry.name.endsWith(".yaml") && entry.name.startsWith("Settings")) {
				context.files.push(entryPath)
			}

			if (entry.isDirectory()) {
				context.contexts[entry.name] = this.getConfigurationContexts(entryPath, entry.name)
			}
		}

		return context
	}

	selectContextPath(path: string) {
		this.selectedContextPath = path
	}

	getContextPath() {
		return this.selectedContextPath
	}

	getContexts(): string[] | undefined {
		if (this.allContexts === undefined || Object.keys(this.allContexts.contexts).length === 0) {
			console.log("allContexts is undefined or empty")
			return undefined
		}

		const getFromContexts = (context: ConfigurationContext): string[] => {
			const list = [context.name]
			for (const subContext of Object.values(context.contexts)) {
				const result = getFromContexts(subContext).map(c => `${context.name}/${c}`)
				list.push(...result)
			}
			return list
		}

		return Object.values(this.allContexts.contexts).reduce((contexts, subContext) => [...contexts, ...getFromContexts(subContext)], [] as string[])
	}

	search(searchPath: string) {
		const results: { value: ParsedYaml, file: FlowConfigurationFile, range: Range }[] = []
		for (const configuration of this.configurations) {
			results.push(...configuration.search(searchPath))
		}
		return results
	}

	getMerged<T extends ParsedYaml>(path: string | string[], settingsConfiguration = this.mergedConfiguration): T | undefined {
		if (settingsConfiguration === undefined || settingsConfiguration === null) return undefined
		if (!Array.isArray(path)) path = path.split(".")

		const key = path.shift()
		if (!key) return undefined

		const value = (<{ [key: string]: any }>settingsConfiguration)[key]
		if (path.length === 0) return value
		if (value === undefined || value === null) return undefined

		return (typeof value === 'object' && typeof value !== 'function') ? this.getMerged(path, value) : undefined
	}
}