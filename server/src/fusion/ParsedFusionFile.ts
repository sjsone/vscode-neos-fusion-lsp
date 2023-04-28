import * as NodeFs from "fs"
import * as NodePath from "path"
import { FusionParserOptions, ObjectTreeParser } from 'ts-fusion-parser'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { FusionWorkspace } from './FusionWorkspace'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { clearLineDataCacheForFile, findParent, getNodeWeight, getObjectIdentifier, getPrototypeNameFromNode, uriToPath } from '../common/util'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { Logger } from '../common/Logging'
import { EelParserOptions } from 'ts-fusion-parser/out/dsl/eel/parser'
import { AfxParserOptions } from 'ts-fusion-parser/out/dsl/afx/parser'
import { FusionFileProcessor } from './FusionFileProcessor'
import { NeosPackage } from '../neos/NeosPackage'
import { AbstractPathSegment } from 'ts-fusion-parser/out/fusion/nodes/AbstractPathSegment'
import { Position } from 'vscode-languageserver'


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

export interface RouteDefinition {
	packageName: string,
	controllerName: string,
	actions: { [key: string]: string[] }
}

export class ParsedFusionFile extends Logger {
	protected fusionFileProcessor: FusionFileProcessor
	public workspace: FusionWorkspace
	public neosPackage: NeosPackage
	public uri: string
	public tokens: any[] = []

	public prototypeCreations: LinePositionedNode<PrototypePathSegment>[] = []
	public prototypeOverwrites: LinePositionedNode<PrototypePathSegment>[] = []
	public prototypeExtends: LinePositionedNode<AbstractNode>[] = []

	public nodesByLine: { [key: string]: LinePositionedNode<AbstractNode>[] } = {}
	public nodesByType: Map<new (...args: unknown[]) => AbstractNode, LinePositionedNode<AbstractNode>[]> = new Map()

	public routeDefinitions: { [key: string]: RouteDefinition } = {}

	public ignoredDueToError = false
	public ignoredErrorsByParser: Error[] = []

	protected debug: boolean

	constructor(uri: string, workspace: FusionWorkspace, neosPackage: NeosPackage) {
		const loggerPrefix = NodePath.basename(uriToPath(uri))
		super(loggerPrefix)
		this.uri = uri
		this.workspace = workspace
		this.neosPackage = neosPackage
		this.debug = this.uri.endsWith("FusionModule/Routing.fusion")
		this.fusionFileProcessor = new FusionFileProcessor(this, loggerPrefix)

		this.logVerbose("Created", uri)
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

	runPostProcessing() {
		this.fusionFileProcessor.runPostProcessing()
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

	protected extractPackageAndControllerNameFromFusionRoute(segments: AbstractPathSegment[]) {
		const fusionRoute = segments.map(s => s["identifier"]).join('.')
		const ownPackageNameWithDot = this.neosPackage.getPackageName() + '.'

		if (fusionRoute.startsWith(ownPackageNameWithDot)) {
			const controllerPathParts = fusionRoute.replace(ownPackageNameWithDot, '').split('.')

			const fullControllerName = controllerPathParts.join('/')
			const controllerName = fullControllerName.replace(/(Controller)$/, "")

			return {
				packageName: this.neosPackage.getPackageName(),
				controllerName
			}
		}


		const packageName = segments.slice(0, 2).map(s => s["identifier"]).join('.')

		const fullControllerName = segments.slice(2).map(s => s["identifier"]).join('/')
		const controllerName = fullControllerName.replace(/(Controller)$/, "")

		return {
			packageName,
			controllerName
		}
	}

	public getRouteDefinitionsForPrototypeName(prototypeName: string) {
		const routeDefinitions: RouteDefinition[] = []
		for (const routeDefinition of Object.values(this.routeDefinitions)) {
			for (const actionName in routeDefinition.actions) {
				const action = routeDefinition.actions[actionName]
				if (action.includes(prototypeName)) routeDefinitions.push(routeDefinition)
			}
		}

		return routeDefinitions
	}

	protected addPrototypeInRoutes(node: PrototypePathSegment | FusionObjectValue) {
		const prototypeName = getPrototypeNameFromNode(node)
		const actionObjectStatement = findParent(node, ObjectStatement)

		const actionName = getObjectIdentifier(actionObjectStatement)
		const controllerObjectStatement = findParent(actionObjectStatement, ObjectStatement)

		const controllerPathSegments = controllerObjectStatement.path.segments

		const { packageName, controllerName } = this.extractPackageAndControllerNameFromFusionRoute(controllerPathSegments)

		const routeIdentifier = packageName + '_' + controllerName

		if (this.routeDefinitions[routeIdentifier] === undefined) this.routeDefinitions[routeIdentifier] = {
			packageName,
			controllerName,
			actions: {}
		}

		if (this.routeDefinitions[routeIdentifier].actions[actionName] === undefined) this.routeDefinitions[routeIdentifier].actions[actionName] = []
		if (!this.routeDefinitions[routeIdentifier].actions[actionName].includes(prototypeName)) this.routeDefinitions[routeIdentifier].actions[actionName].push(prototypeName)
	}

	getNodesByPosition(position: Position) {
		const line = position.line
		const column = position.character
		return this.getNodesByLineAndColumn(line, column)
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
