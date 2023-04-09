import * as NodeFs from "fs"
import * as NodePath from "path"
import { Position, Range } from 'vscode-languageserver'
import { Logger, LogService } from '../common/Logging'
import { getFiles, mergeObjects } from '../common/util'
import { LoggingLevel } from '../ExtensionConfiguration'
import { FlowConfigurationFile, FlowConfigurationFileType, NodeTypeDefinition, ParsedYaml } from './FlowConfigurationFile'
import { NeosPackage } from './NeosPackage'
import { NeosWorkspace } from './NeosWorkspace'

export class FlowConfiguration extends Logger {
	protected settingsConfiguration: ParsedYaml
	protected nodeTypeDefinitions: NodeTypeDefinition[]
	protected configurationFiles: FlowConfigurationFile[] = []
	protected neosWorkspace: NeosWorkspace
	protected folderPath: string

	protected constructor(neosWorkspace: NeosWorkspace, folderPath: string) {
		super(NodePath.basename(folderPath))
		this.folderPath = folderPath
		this.neosWorkspace = neosWorkspace

		this.logDebug("Created", folderPath)
		// this.logInfo("ContextPath", neosPackage["neosWorkspace"].configurationManager.getContextPath())
	}

	get<T extends ParsedYaml>(path: string | string[], settingsConfiguration = this.settingsConfiguration): T {
		if (settingsConfiguration === undefined || settingsConfiguration === null) return undefined
		if (!Array.isArray(path)) path = path.split(".")
		const key = path.shift()
		const value = settingsConfiguration[key]
		if (path.length === 0) return value
		if (value === undefined || value === null) return undefined
		return (typeof value === 'object' && typeof value !== 'function') ? this.get(path, value) : undefined
	}

	search<T extends ParsedYaml>(path: string | string[], filterByCurrentFlowContext = true): { value: T, file: FlowConfigurationFile, range: Range }[] {
		if (!Array.isArray(path)) path = path.split(".")

		const results: { value: T, file: FlowConfigurationFile, range: Range }[] = []
		const contextPath = this.neosWorkspace.configurationManager.getContextPath()

		for (const configurationFile of this.configurationFiles) {
			if (filterByCurrentFlowContext && !configurationFile.isOfContext(contextPath)) continue

			const value = configurationFile.getValueByPath(path)

			if (value != undefined) {
				const resolvedRange = configurationFile.resolvePositionRangeForPath(path)
				// console.log("Found resolvedRange ", resolvedRange, configurationFile["uri"])

				results.push({
					range: resolvedRange ?? Range.create(Position.create(0, 0), Position.create(0, 0)),
					value: <any>value,
					file: configurationFile
				})
			}
		}

		return results
	}

	protected readNodeTypeDefinitionsFromNodeTypesFolder() {
		this.nodeTypeDefinitions = []
		const nodeTypeDefinitionsFolderPath = NodePath.join(this.folderPath, 'NodeTypes')
		if (!NodeFs.existsSync(nodeTypeDefinitionsFolderPath)) return

		for (const nodeTypeFilePath of getFiles(nodeTypeDefinitionsFolderPath, ".yaml")) {
			const configurationFile = new FlowConfigurationFile(nodeTypeFilePath)
			this.nodeTypeDefinitions.push(...configurationFile.parseNodeTypeDefinitions())
			this.configurationFiles.push(configurationFile)
		}
	}

	protected readConfigurationsFromConfigurationFolder() {
		this.settingsConfiguration = {}
		const settingsFolderPath = NodePath.join(this.folderPath, 'Configuration')
		if (!NodeFs.existsSync(settingsFolderPath)) return

		for (const configurationFilePath of getFiles(settingsFolderPath, ".yaml")) {
			const configurationFile = new FlowConfigurationFile(configurationFilePath)

			if (configurationFile.isOfType(FlowConfigurationFileType.Settings)) {
				const parsedYaml = configurationFile.parseYaml()

				try {
					const mergedConfiguration = <ParsedYaml>mergeObjects(parsedYaml, this.settingsConfiguration)
					this.settingsConfiguration = mergedConfiguration ? mergedConfiguration : this.settingsConfiguration
					if (LogService.isLogLevel(LoggingLevel.Debug)) Logger.LogNameAndLevel(LoggingLevel.Debug.toUpperCase(), 'FlowConfiguration:FromFolder', 'Read configuration from: ' + configurationFilePath)
				} catch (e) {
					if (e instanceof Error) {
						console.log("ERROR: configuration", this.settingsConfiguration)
						console.log("    ", e.message, e.stack)
					}
				}
			}

			if (configurationFile.isOfType(FlowConfigurationFileType.NodeTypes)) {
				this.nodeTypeDefinitions.push(...configurationFile.parseNodeTypeDefinitions())
			}

			this.configurationFiles.push(configurationFile)
		}
	}

	static ForPackage(neosPackage: NeosPackage) {
		const configuration = new FlowConfiguration(neosPackage["neosWorkspace"], neosPackage["path"]);
		configuration.readNodeTypeDefinitionsFromNodeTypesFolder()
		configuration.readConfigurationsFromConfigurationFolder()
		neosPackage["neosWorkspace"]["configurationManager"]["configurations"].push(configuration)
		return configuration
	}

	static ForPath(neosWorkspace: NeosWorkspace, folderPath: string) {
		const configuration = new FlowConfiguration(neosWorkspace, folderPath);
		configuration.readConfigurationsFromConfigurationFolder()
		neosWorkspace["configurationManager"]["configurations"].push(configuration)
		return configuration
	}

}