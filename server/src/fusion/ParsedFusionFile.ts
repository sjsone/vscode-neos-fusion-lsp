import * as NodeFs from "fs"
import * as NodePath from "path"
import { ObjectTreeParser } from 'ts-fusion-parser'
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
import { Diagnostic } from 'vscode-languageserver'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/nodes/MetaPathSegment'
import { StringValue } from 'ts-fusion-parser/out/fusion/nodes/StringValue'
import { FqcnNode } from './FqcnNode'
import { ResourceUriNode } from './ResourceUriNode'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { diagnose } from '../diagnostics/ParsedFusionFileDiagnostics'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { ActionUriActionNode } from './ActionUriActionNode'
import { ActionUriControllerNode } from './ActionUriControllerNode'
import { ActionUriDefinitionNode } from './ActionUriDefinitionNode'
import { LiteralStringNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode'
import { Logger } from '../common/Logging'
import { FusionFile } from 'ts-fusion-parser/out/fusion/nodes/FusionFile'
import { GlobalCache } from '../common/Cache'

export class ParsedFusionFile extends Logger {
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
		super(NodePath.basename(uriToPath(uri)))
		this.uri = uri
		this.workspace = workspace
		this.debug = this.uri.endsWith("Test.fusion")
	}

	init(text: string = undefined) {
		GlobalCache.clearByTag(this.uri)
		try {
			this.clearCaches()
			this.logVerbose("init")
			if (text === undefined) {
				text = NodeFs.readFileSync(uriToPath(this.uri)).toString()
				this.logVerbose("    read text from file")
			}

			const objectTree = ObjectTreeParser.parse(text, undefined, true)
			this.ignoredErrorsByParser = objectTree.errors
			this.readStatementList(objectTree.statementList, text)

			for (const nodeType of objectTree.nodesByType.keys()) {
				this.handleNodesByType(nodeType, objectTree, text)
			}
			if (this.uri.endsWith("FusionModules/Routing.fusion")) this.handleFusionRouting(text)
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

	handleNodesByType(nodeType: any, objectTree: FusionFile, text: string) {
		for (const node of objectTree.nodesByType.get(nodeType)) {
			if (node instanceof ObjectNode) this.handleEelObjectNode(node, text)
			if (node instanceof TagNode) this.handleTagNameNode(node, text)
			if (node instanceof TagAttributeNode) this.handleTagAttributeNode(node, text)
			if (node instanceof ObjectStatement) this.handleObjectStatement(node, text)
			if (node instanceof FusionObjectValue) this.handleFusionObjectValue(node, text)
			if (node instanceof LiteralStringNode) this.handleLiteralStringNode(node, text)
			this.addNode(node, text)
		}
	}

	handleEelObjectNode(node: ObjectNode, text: string) {
		const eelHelperTokens = this.workspace.neosWorkspace.getEelHelperTokens()

		const currentPath: ObjectPathNode[] = []
		for (const part of node.path) {
			currentPath.push(part)
			const isLastPathPart = currentPath.length === node.path.length

			if (!(part instanceof ObjectFunctionPathNode) && !(isLastPathPart && (part instanceof ObjectPathNode))) continue

			if (currentPath.length === 1) {
				// TODO: Allow immediate EEL-Helper (like "q(...)")
				continue
			}

			const methodNode = currentPath.pop()
			const eelHelperMethodNodePosition = new NodePosition(methodNode["position"].begin, methodNode["position"].begin + methodNode["value"].length)
			const eelHelperMethodNode = new PhpClassMethodNode(methodNode["value"], part, eelHelperMethodNodePosition)

			const { position, eelHelperIdentifier } = this.createEelHelperIdentifierAndPositionFromPath(currentPath)
			for (const eelHelper of eelHelperTokens) {
				if (eelHelper.name !== eelHelperIdentifier) continue

				const method = eelHelper.methods.find(method => method.valid(methodNode["value"]))
				if (!method) continue

				this.addNode(eelHelperMethodNode, text)
				const eelHelperNode = new PhpClassNode(eelHelperIdentifier, eelHelperMethodNode, node, position)
				this.addNode(eelHelperNode, text)
			}
		}
	}

	createEelHelperIdentifierAndPositionFromPath(path: ObjectPathNode[]) {
		const position = new NodePosition(-1, -1)
		const nameParts = []
		for (const method of path) {
			const value = method["value"]
			nameParts.push(value)
			if (position.begin === -1) position.begin = method["position"].begin
			position.end = method["position"].end
		}

		return {
			eelHelperIdentifier: nameParts.join("."),
			position
		}
	}

	handleTagNameNode(node: TagNode, text: string) {
		const identifier = node["name"]
		if (!identifier.includes(".") || !identifier.includes(":")) return

		const prototypePath = new PrototypePathSegment(identifier, new NodePosition(
			node["position"].begin + 1,
			node["position"].begin + 1 + identifier.length
		))

		prototypePath["parent"] = node["parent"]
		this.addNode(prototypePath, text)

		if (node["selfClosing"] || node["end"] === undefined) return

		const endOffset = node["end"]["name"].indexOf(identifier)
		const endPrototypePath = new PrototypePathSegment(identifier, new NodePosition(
			node["end"]["position"].begin + endOffset,
			node["end"]["position"].begin + endOffset + identifier.length
		))

		endPrototypePath["parent"] = node["parent"]
		this.addNode(endPrototypePath, text)
	}

	handleTagAttributeNode(node: TagAttributeNode, text: string) {
		if (typeof node.value === "string") {
			const value = node.value.substring(1, node.value.length - 1)
			if (value.startsWith("resource://")) {
				const position: NodePosition = {
					begin: node["position"].end - value.length - 1,
					end: node["position"].end
				}
				const resourceUriNode = new ResourceUriNode(value, position, node["parent"])
				if (resourceUriNode) this.addNode(resourceUriNode, text)
			}

		}
		// this.addNode(endPrototypePath, text)
	}

	handleObjectStatement(objectStatement: ObjectStatement, text: string) {
		const segments = objectStatement.path.segments
		const metaPathSegment = segments[0] instanceof PrototypePathSegment ? segments[1] : segments[0]

		if (objectStatement.operation instanceof ValueAssignment) {
			if (metaPathSegment instanceof MetaPathSegment) return this.handleMetaObjectStatement(objectStatement, metaPathSegment, text)
			if (objectStatement.operation.pathValue instanceof StringValue) return this.handleStringValue(objectStatement.operation.pathValue, text)
		}
	}

	handleMetaObjectStatement(objectStatement: ObjectStatement, metaPathSegment: MetaPathSegment, text: string) {
		if (!(metaPathSegment instanceof MetaPathSegment)) return
		if (metaPathSegment.identifier !== "class" && metaPathSegment.identifier !== "exceptionHandler") return
		const operation = <ValueAssignment>objectStatement.operation
		if (!(operation.pathValue instanceof StringValue)) return
		const fqcn = operation.pathValue.value.split("\\\\").join("\\")
		const classDefinition = this.workspace.neosWorkspace.getClassDefinitionFromFullyQualifiedClassName(fqcn)
		if (classDefinition === undefined) return

		const fqcnNode = new FqcnNode(operation.pathValue.value, classDefinition, operation.pathValue["position"])
		this.addNode(fqcnNode, text)
	}

	handleStringValue(stringValue: StringValue, text: string) {
		const value = stringValue.value
		if (value.startsWith("resource://")) {
			const resourceUriNode = new ResourceUriNode(value, stringValue["position"], stringValue["parent"])
			if (resourceUriNode) this.addNode(resourceUriNode, text)
		}
	}

	handleFusionObjectValue(fusionObjectValue: FusionObjectValue, text: string) {
		if (!["Neos.Fusion:ActionUri", "Neos.Fusion:UriBuilder"].includes(fusionObjectValue.value)) return
		const objectStatement = findParent(fusionObjectValue, ObjectStatement)
		if (!objectStatement || !objectStatement.block) return
		const actionUriDefinitionNode = new ActionUriDefinitionNode(objectStatement)

		for (const statement of objectStatement.block.statementList.statements) {
			if (!(statement instanceof ObjectStatement)) continue
			if (!(statement.operation instanceof ValueAssignment)) continue
			if (!(statement.operation.pathValue instanceof StringValue)) continue


			if (getObjectIdentifier(statement) === "action") {
				const actionUriActionNode = new ActionUriActionNode(statement, statement.operation.pathValue)
				actionUriDefinitionNode.setAction(actionUriActionNode)
				this.addNode(actionUriActionNode, text)
			}

			if (getObjectIdentifier(statement) === "controller") {
				const actionUriControllerNode = new ActionUriControllerNode(statement, statement.operation.pathValue)
				actionUriDefinitionNode.setController(actionUriControllerNode)
				this.addNode(actionUriControllerNode, text)
			}

		}
		this.addNode(actionUriDefinitionNode, text)

	}

	protected handleLiteralStringNode(literalStringNode: LiteralStringNode, text: string) {
		const value = literalStringNode["value"]
		if (value.startsWith("resource://")) {
			const resourceUriNode = new ResourceUriNode(value, literalStringNode["position"], literalStringNode["parent"])
			if (resourceUriNode) this.addNode(resourceUriNode, text)
		}
	}

	getNodesByType<T extends AbstractNode>(type: new (...args: any) => T): LinePositionedNode<T>[] | undefined {
		return <LinePositionedNode<T>[] | undefined>this.nodesByType.get(type)
	}

	addNode(node: AbstractNode, text: string) {
		if (node["position"] === undefined) return
		const nodeByLine = this.createNodeByLine(node, text)

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

	public async diagnose(): Promise<Diagnostic[] | null> {
		return diagnose(this)
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

	clear() {
		this.tokens = []
		this.prototypeCreations = []
		this.prototypeOverwrites = []
		this.prototypeExtends = []
		this.nodesByLine = {}
		this.nodesByType = new Map()
	}

	createNodeByLine<T extends AbstractNode>(node: T, text: string) {
		return new LinePositionedNode<T>(node, text, this.uri)
	}

	readStatementList(statementList: StatementList, text: string) {
		for (const rootStatement of statementList.statements) {
			if (rootStatement instanceof ObjectStatement) {
				this.readObjectStatement(rootStatement, text)
			} else {
				// console.log(rootStatement)
			}
		}
	}

	readObjectStatement(statement: ObjectStatement, text: string) {
		const firstPathSegment = statement.path.segments[0]
		const operation = statement.operation
		if (firstPathSegment instanceof PrototypePathSegment) {
			const nodeByLine = this.createNodeByLine(firstPathSegment, text)
			if (operation instanceof ValueCopy) {
				this.prototypeCreations.push(nodeByLine)

				const sourceFusionPrototype = operation.assignedObjectPath.objectPath.segments[0]
				if (sourceFusionPrototype instanceof PrototypePathSegment) {
					this.prototypeExtends.push(this.createNodeByLine(sourceFusionPrototype, text))
				}

			} else {
				this.prototypeOverwrites.push(nodeByLine)
			}
		} else if (firstPathSegment instanceof PathSegment) {
			this.addNode(firstPathSegment, text)
		}

		if (statement.block !== undefined) {
			this.readStatementList(statement.block.statementList, text)
		}
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
}
