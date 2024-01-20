import * as NodeFs from "fs"
import * as NodePath from "path"
import { Position } from 'vscode-languageserver'
import { parse as parseYaml } from 'yaml'
import { Logger, LogService } from '../common/Logging'
import { getFiles, mergeObjects, pathToUri } from '../common/util'
import { LoggingLevel } from '../ExtensionConfiguration'
import { YamlLexer } from '../yaml/YamlLexer'

export type ParsedYaml = string | null | number | boolean | { [key: string]: ParsedYaml }

export interface NodeTypeDefinition {
	uri: string
	nodeType: string
	position: Position
}

export class FlowConfiguration extends Logger {
	public settingsConfiguration: ParsedYaml
	public nodeTypeDefinitions: NodeTypeDefinition[]

	protected constructor(settingsConfiguration: ParsedYaml, nodeTypeDefinitions: NodeTypeDefinition[]) {
		super()
		this.settingsConfiguration = settingsConfiguration
		this.nodeTypeDefinitions = nodeTypeDefinitions
	}

	get<T extends ParsedYaml>(path: string | string[], settingsConfiguration = this.settingsConfiguration): T | undefined {
		if (settingsConfiguration === undefined || settingsConfiguration === null) return undefined
		if (!Array.isArray(path)) path = path.split(".")
		const key = path.shift()!
		const value = (<{ [key: string]: any }>settingsConfiguration)[key]
		if (path.length === 0) return value
		if (value === undefined || value === null) return undefined
		return (typeof value === 'object' && typeof value !== 'function') ? this.get(path, value) : undefined
	}

	static FromFolder(folderPath: string) {
		const nodeTypeDefinitions = []
		const nodeTypeDefinitionsFolderPath = NodePath.join(folderPath, 'NodeTypes')
		if (NodeFs.existsSync(nodeTypeDefinitionsFolderPath)) {
			nodeTypeDefinitions.push(...FlowConfiguration.ReadNodeTypesFolderConfiguration(nodeTypeDefinitionsFolderPath))
		}

		let settings = {}
		const settingsFolderPath = NodePath.join(folderPath, 'Configuration')
		if (NodeFs.existsSync(settingsFolderPath)) {
			const settingsAndNodeTypes = FlowConfiguration.ReadSettingsAndNodeTypesConfiguration(settingsFolderPath)
			settings = settingsAndNodeTypes.configuration
			nodeTypeDefinitions.push(...settingsAndNodeTypes.nodeTypeDefinitions)
		}

		return new FlowConfiguration(settings, nodeTypeDefinitions)
	}

	protected static ReadSettingsAndNodeTypesConfiguration(folderPath: string) {
		const nodeTypeDefinitions: NodeTypeDefinition[] = []
		let configuration: ParsedYaml = {}

		const yamlFiles: string[] = [...getFiles(folderPath, ".yaml"), ...getFiles(folderPath, ".yml")]
		for (const configurationFilePath of yamlFiles) {
			if (NodePath.basename(configurationFilePath).startsWith("Settings")) {
				const configurationFileYaml = NodeFs.readFileSync(configurationFilePath).toString()
				const parsedYaml = parseYaml(configurationFileYaml)

				if (parsedYaml) try {
					const mergedConfiguration = <ParsedYaml>mergeObjects(parsedYaml, <any>configuration)
					configuration = mergedConfiguration ?? configuration
					if (LogService.isLogLevel(LoggingLevel.Debug)) {
						Logger.LogNameAndLevel(LoggingLevel.Debug.toUpperCase(), 'FlowConfiguration:FromFolder', 'Read configuration from: ' + configurationFilePath)
					}
				} catch (error) {
					if (error instanceof Error) {
						Logger.LogNameAndLevel(
							LoggingLevel.Error.toUpperCase(),
							'FlowConfiguration:FromFolder',
							"trying to read configuration from: ", configurationFilePath, configuration, error
						)
					}
				}
			}

			if (NodePath.basename(configurationFilePath).startsWith('NodeTypes')) {
				nodeTypeDefinitions.push(...FlowConfiguration.ReadNodeTypeConfiguration(configurationFilePath))
			}
		}

		return { configuration, nodeTypeDefinitions }
	}

	protected static ReadNodeTypesFolderConfiguration(nodeTypeDefinitionsFolderPath: string): NodeTypeDefinition[] {
		const nodeTypeDefinitions: NodeTypeDefinition[] = []

		for (const nodeTypeFilePath of getFiles(nodeTypeDefinitionsFolderPath, ".yaml")) {
			nodeTypeDefinitions.push(...FlowConfiguration.ReadNodeTypeConfiguration(nodeTypeFilePath))
		}

		return nodeTypeDefinitions
	}


	protected static ReadNodeTypeConfiguration(nodeTypeFilePath: string): NodeTypeDefinition[] {
		const nodeTypeDefinitions: NodeTypeDefinition[] = []

		try {
			const configurationFileYaml = NodeFs.readFileSync(nodeTypeFilePath).toString()
			const yamlLexer = new YamlLexer(configurationFileYaml, nodeTypeFilePath)
			for (const yamlToken of yamlLexer.tokenize()) {
				if (yamlToken.indent !== 0) continue
				if (yamlToken.type !== "complex_string" && yamlToken.type !== "string") continue

				const match = /^[0-9a-zA-Z.]+(?::[0-9a-zA-Z.]+$)/m.exec(yamlToken.value)
				if (match === null) continue

				nodeTypeDefinitions.push({
					uri: pathToUri(nodeTypeFilePath),
					nodeType: match[0],
					position: Position.create(0, 0)
				})
			}
		} catch (e) {
			if (e instanceof Error) {
				console.log("ERROR: ReadNodeTypeConfiguration", nodeTypeFilePath)
				console.log("\\----: ", e.message, e.stack)
			}
		}

		return nodeTypeDefinitions
	}
}