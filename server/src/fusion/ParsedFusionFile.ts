import * as NodeFs from "fs"
import * as NodePath from "path"
import { FusionParserOptions, ObjectTreeParser } from 'ts-fusion-parser'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { NodePosition } from 'ts-fusion-parser/out/common/NodePosition'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { StatementList } from 'ts-fusion-parser/out/fusion/nodes/StatementList'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { ValueCopy } from 'ts-fusion-parser/out/fusion/nodes/ValueCopy'
import { PhpClassMethodNode } from './PhpClassMethodNode'
import { PhpClassNode } from './PhpClassNode'
import { FusionWorkspace } from './FusionWorkspace'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { clearLineDataCacheForFile, findParent, getNodeWeight, getObjectIdentifier, getPrototypeNameFromNode, uriToPath } from '../common/util'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/nodes/MetaPathSegment'
import { StringValue } from 'ts-fusion-parser/out/fusion/nodes/StringValue'
import { FqcnNode } from './FqcnNode'
import { ResourceUriNode } from './ResourceUriNode'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { ActionUriActionNode } from './ActionUriActionNode'
import { ActionUriControllerNode } from './ActionUriControllerNode'
import { ActionUriDefinitionNode } from './ActionUriDefinitionNode'
import { LiteralStringNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode'
import { Logger } from '../common/Logging'
import { FusionFile } from 'ts-fusion-parser/out/fusion/nodes/FusionFile'
import { EelParserOptions } from 'ts-fusion-parser/out/dsl/eel/parser'
import { AfxParserOptions } from 'ts-fusion-parser/out/dsl/afx/parser'
import { FusionFileProcessor } from './FusionFileProcessor'


const eelParserOptions: EelParserOptions = {
	allowIncompleteObjectPaths: true
}

const afxParserOptions: AfxParserOptions = {
	eelParserOptions,
	allowUnclosedTags: true
}

const fusionParserOptions: FusionParserOptions = {
	afxParserOptions,
	eelParserOptions,
	ignoreErrors: true
}


export class ParsedFusionFile extends Logger {
	protected fusionFileProcessor: FusionFileProcessor
	public workspace: FusionWorkspace
	public uri: string
	public tokens: any[] = []

	public prototypeCreations: LinePositionedNode<PrototypePathSegment>[] = []
	public prototypeOverwrites: LinePositionedNode<PrototypePathSegment>[] = []
	public prototypeExtends: LinePositionedNode<AbstractNode>[] = []

	public nodesByLine: { [key: string]: LinePositionedNode<AbstractNode>[] } = {}
	public nodesByType: Map<new (...args: unknown[]) => AbstractNode, LinePositionedNode<AbstractNode>[]> = new Map()
	public prototypesInRoutes: { [key: string]: { action: string, controller: string, package?: string }[] } = {}

	public ignoredDueToError = false
	public ignoredErrorsByParser: Error[] = []

	protected debug: boolean

	constructor(uri: string, workspace: FusionWorkspace) {
		const loggerPrefix = NodePath.basename(uriToPath(uri))
		super(loggerPrefix)
		this.fusionFileProcessor = new FusionFileProcessor(this, loggerPrefix)
		this.uri = uri
		this.workspace = workspace
		this.debug = this.uri.endsWith("Test.fusion")
	}

	init(text: string = undefined) {
		try {
			this.clearCaches()
			this.logVerbose("init")
			if (text === undefined) {
				text = NodeFs.readFileSync(uriToPath(this.uri)).toString()
				this.logVerbose("    read text from file")
			}

			const objectTree = ObjectTreeParser.parse(text, undefined, fusionParserOptions)
			this.ignoredErrorsByParser = objectTree.errors
			this.fusionFileProcessor.readStatementList(objectTree.statementList, text)

			for (const nodeType of objectTree.nodesByType.keys()) {
				this.fusionFileProcessor.processNodesByType(nodeType, objectTree, text)
			}
			const fileName = NodePath.basename(uriToPath(this.uri))
			if (fileName.startsWith("Routing") && fileName.endsWith(".fusion")) this.handleFusionRouting(text)
			this.logVerbose("finished")
			return true
		} catch (e) {
			if (e instanceof Error) {
				this.logVerbose("    Error: ", e.message)
				console.log("Caught: ", e.message, e.stack)
			}

			return false
		}
	}

	clearCaches() {
		clearLineDataCacheForFile(this.uri)
		this.logVerbose("Cleared caches")
	}

	getNodesByType<T extends AbstractNode>(type: new (...args: any) => T): LinePositionedNode<T>[] | undefined {
		return <LinePositionedNode<T>[] | undefined>this.nodesByType.get(type)
	}

	addNode(node: AbstractNode, text: string) {
		if (node["position"] === undefined) return
		const nodeByLine = new LinePositionedNode(node, text, this.uri)

		for (let line = nodeByLine.getBegin().line; line <= nodeByLine.getEnd().line; line++) {
			if (this.nodesByLine[line] === undefined) this.nodesByLine[line] = []
			this.nodesByLine[line].push(nodeByLine)
		}

		this.addToNodeByType(node.constructor, nodeByLine)
	}

	protected addToNodeByType(type: any, node: LinePositionedNode<AbstractNode>) {
		const nodesWithType = this.nodesByType.get(type) ?? []
		nodesWithType.push(node)
		this.nodesByType.set(type, nodesWithType)
	}

	protected handleFusionRouting(text: string) {
		const fusionObjectValues = this.getNodesByType(FusionObjectValue) ?? []
		for (const fusionObjectValue of fusionObjectValues) {
			const node = fusionObjectValue.getNode()
			this.addPrototypeInRoutes(node)
		}

		const prototypePathSegments = this.getNodesByType(PrototypePathSegment) ?? []
		for (const prototypePathSegment of prototypePathSegments) {
			const node = prototypePathSegment.getNode()
			this.addPrototypeInRoutes(node)
		}
	}

	protected addPrototypeInRoutes(node: PrototypePathSegment | FusionObjectValue) {
		const prototypeName = getPrototypeNameFromNode(node)
		const actionObjectStatement = findParent(node, ObjectStatement)

		const actionName = getObjectIdentifier(actionObjectStatement)
		const controllerObjectStatement = findParent(actionObjectStatement, ObjectStatement)

		const controllerPathSegments = controllerObjectStatement.path.segments

		const packageName = controllerPathSegments.slice(0, 2).map(s => s["identifier"]).join('.')

		const fullControllerName = controllerPathSegments.slice(2).map(s => s["identifier"]).join('/')
		const controllerName = fullControllerName.replace(/(Controller)$/, "")

		if (this.prototypesInRoutes[prototypeName] === undefined) this.prototypesInRoutes[prototypeName] = []

		this.prototypesInRoutes[prototypeName].push({
			action: actionName,
			controller: controllerName,
			package: packageName
		})
	}

	getNodesByLineAndColumn(line: number, column: number) {
		const lineNodes = this.nodesByLine[line]
		if (lineNodes === undefined) return undefined
		return lineNodes.filter(lineNode => column >= lineNode.getBegin().character && column <= lineNode.getEnd().character)
	}

	getNodeByLineAndColumn(line: number, column: number): LinePositionedNode<AbstractNode> | undefined {
		const lineNodes = this.nodesByLine[line]
		if (lineNodes === undefined) return undefined

		const foundNodesByWeight: { [key: number]: LinePositionedNode<AbstractNode> } = {}
		for (const lineNode of lineNodes) {
			if (column >= lineNode.getBegin().character && column <= lineNode.getEnd().character) {
				const node = lineNode.getNode()
				const weight = getNodeWeight(node)
				if (foundNodesByWeight[weight] === undefined) {
					foundNodesByWeight[weight] = lineNode
				}
			}
		}

		const sortedKeys = Object.keys(foundNodesByWeight).sort((a, b) => parseInt(b) - parseInt(a))
		if (sortedKeys.length === 0) return undefined
		return foundNodesByWeight[sortedKeys[0]]
	}

	clear() {
		this.tokens = []
		this.prototypeCreations = []
		this.prototypeOverwrites = []
		this.prototypeExtends = []
		this.nodesByLine = {}
		this.nodesByType = new Map()
	}
}
