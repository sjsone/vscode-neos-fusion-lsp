import * as NodeFs from "fs"
import * as NodePath from "path"
import { Position } from 'vscode-languageserver'
import { parse as parseYaml } from 'yaml'
import { Logger } from '../common/Logging'
import { pathToUri } from '../common/util'
import { YamlLexer } from '../yaml/YamlLexer'
import { YamlToken } from '../yaml/YamlToken'
import { AbstractListYamlNode, AbstractYamlNode, DocumentNode } from '../yaml/YamlNodes'
import { YamlParser } from '../yaml/YamlParser'

export type ParsedYaml = string | null | number | { [key: string]: ParsedYaml }

export enum FlowConfigurationFileType {
	Settings = 'settings',
	NodeTypes = 'node_types',
	Objects = 'objects',
	Policy = 'policy',
	Routes = 'routes',
	Views = 'views',
	Unknown = 'unknown',
}

export interface NodeTypeDefinition {
	uri: string
	nodeType: string
	position: Position
}

export class FlowConfigurationFile extends Logger {
	protected path: string
	protected uri: string
	protected type: FlowConfigurationFileType = FlowConfigurationFileType.Unknown
	protected context: string
	protected parsedYaml?: ParsedYaml
	protected nodeTypeDefinitions: NodeTypeDefinition[] = []
	protected yamlTokens: YamlToken[] = []

	protected positionedParsedYaml?: DocumentNode

	constructor(path: string) {
		const fileName = NodePath.basename(path)
		super(fileName.replace(".yaml", ""))

		this.path = path
		this.uri = pathToUri(path)

		if (fileName.startsWith("Settings")) this.type = FlowConfigurationFileType.Settings
		if (fileName.startsWith("NodeTypes")) this.type = FlowConfigurationFileType.NodeTypes

		// this.logInfo("Created", this.type, this.path)

		const rawContext = this.path.slice(this.path.indexOf("Configuration/") + "Configuration/".length, this.path.indexOf(fileName))
		this.context = rawContext.split(NodePath.sep).filter(Boolean).join("/")

		// this.logInfo(`context "${this.context}"`)
	}

	public getValueByPath(path: string[]) {
		if (!this.parsedYaml) return undefined

		let pointer = this.parsedYaml
		for (const part of path) {
			pointer = pointer[part]
			if (pointer === undefined) return undefined
		}
		return pointer
	}

	public resolvePositionRangeForPath(path: string[]) {
		if (this.positionedParsedYaml === undefined) {
			try {
				this.positionedParsedYaml = YamlParser.Parse(this.uri)
			} catch (error) {
				this.logVerbose("Error while parsing", this.uri, error)
				this.positionedParsedYaml = null
			}
		}
		if (!(this.positionedParsedYaml instanceof DocumentNode)) return undefined

		const result = this.getNodeByPathInListNode(this.positionedParsedYaml, path)
		if (result === undefined) return undefined
		return result["token"]?.["range"]
	}

	public isOfContext(context: string) {
		if (this.context === "") return true
		return context.startsWith(this.context)
	}

	public isOfType(type: FlowConfigurationFileType) {
		return this.type === type
	}

	public parseYaml() {
		const configurationFileYaml = NodeFs.readFileSync(this.path).toString()
		this.parsedYaml = parseYaml(configurationFileYaml)
		return this.parsedYaml
	}

	public parseNodeTypeDefinitions() {
		this.nodeTypeDefinitions = []

		try {
			const configurationFileYaml = NodeFs.readFileSync(this.path).toString()
			const yamlLexer = new YamlLexer(configurationFileYaml)

			for (const yamlToken of yamlLexer.tokenize()) {
				if (yamlToken.indent !== 0) continue
				if (yamlToken.type !== "complexstring" && yamlToken.type !== "string") continue

				const match = /^[0-9a-zA-Z.]+(?::[0-9a-zA-Z.]+$)/m.exec(yamlToken.value)
				if (match === null) continue

				this.nodeTypeDefinitions.push({
					uri: pathToUri(this.path),
					nodeType: match[0],
					position: Position.create(0, 0)
				})
			}
		} catch (e) {
			if (e instanceof Error) {
				this.logInfo("ERROR: ReadNodeTypeConfiguration", this.path)
				this.logInfo("\\----: ", e.message, e.stack)
			}
		}
		return this.nodeTypeDefinitions
	}

	public reset() {
		this.parsedYaml = undefined
		this.nodeTypeDefinitions = []
		this.yamlTokens = []
		this.positionedParsedYaml = undefined
	}

	protected getNodeByPathInListNode(listNode: AbstractListYamlNode, path: string[]): undefined | AbstractYamlNode {
		let node: AbstractYamlNode = listNode
		for (const part of path) {
			if (!(part in node["nodes"])) return undefined
			node = node["nodes"][part]
		}
		return node
	}
}