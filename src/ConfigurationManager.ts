import * as NodeFs from "fs"
import * as NodePath from "path"
import { Logger } from './common/Logging'
import { NeosWorkspace } from './neos/NeosWorkspace'

export interface ConfigurationContext {
	name: string,
	files: string[],
	contexts: { [key: string]: ConfigurationContext }
}

export class ConfigurationManager extends Logger {
	protected workspace: NeosWorkspace
	protected packagePaths: string[] = []
	protected allContexts?: ConfigurationContext
	protected selectedContextPath?: string = "Development"

	constructor(workspace: NeosWorkspace) {
		super()
		this.workspace = workspace
	}

	addPackage(path: string) {
		// this.logInfo(`Adding package ${path}`)
		this.packagePaths.push(path)
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

		return Object.values(this.allContexts.contexts).reduce((contexts, subContext) => [...contexts, ...getFromContexts(subContext)], [])
	}
}