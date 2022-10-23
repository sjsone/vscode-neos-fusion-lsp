import * as NodeFs from "fs"
import * as NodePath from "path"
import { ObjectTreeParser } from 'ts-fusion-parser'
import { AbstractNode } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/AbstractNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue'
import { NodePosition } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/NodePosition'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment'
import { StatementList } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/StatementList'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueAssignment'
import { ValueCopy } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueCopy'
import { EelHelperMethodNode } from './EelHelperMethodNode'
import { EelHelperNode } from './EelHelperNode'
import { FusionWorkspace } from './FusionWorkspace'
import { LinePositionedNode } from '../LinePositionedNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/eel/nodes/ObjectPathNode'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/eel/nodes/ObjectNode'
import { TagNameNode } from 'ts-fusion-parser/out/afx/nodes/TagNameNode'
import { TagNode } from 'ts-fusion-parser/out/afx/nodes/TagNode'

export class ParsedFusionFile {
	public workspace: FusionWorkspace
	public uri: string
	public tokens: any[] = []

	public prototypeCreations: LinePositionedNode<AbstractNode>[] = []
	public prototypeOverwrites: LinePositionedNode<AbstractNode>[] = []
	public prototypeExtends: LinePositionedNode<AbstractNode>[] = []

	public nodesByLine: { [key: string]: LinePositionedNode<AbstractNode>[] } = {}
	public nodesByType: Map<any, LinePositionedNode<AbstractNode>[]> = new Map()

	public ignoredDueToError = false
	public igoredErrorsByParser: Error[] = []

	protected debug: boolean

	constructor(uri: string, workspace: FusionWorkspace) {
		this.uri = uri
		this.workspace = workspace
		this.debug = false
	}

	init(text: string = undefined) {
		try {
			if (text === undefined) {
				const file = NodeFs.readFileSync(this.uri.replace("file://", ""))
				text = file.toString()
			}

			const objectTree = ObjectTreeParser.parse(text, undefined, true)
			this.igoredErrorsByParser = objectTree.errors
			this.readStatementList(objectTree.statementList, text)

			for (const nodeType of objectTree.nodesByType.keys()) {
				for (const node of objectTree.nodesByType.get(nodeType)) {
					if (node instanceof ObjectNode) this.handleEelObjectNode(node, text)
					if (node instanceof TagNode) this.handleTagNameNode(node, text)
					this.addNode(node, text)
				}
			}
			return true
		} catch (e) {
			if (e instanceof Error) {
				console.log("Caught: ", e.message, e.stack)
			}

			return false
		}
	}

	handleEelObjectNode(node: ObjectNode, text: string) {
		const path = node.path.map(part => part["value"]).join(".")
		const eelHelperTokens = this.workspace.neosWorkspace.getEelHelperTokens()

		const currentPath: ObjectPathNode[] = []
		for (const part of node.path) {
			currentPath.push(part)

			if (part instanceof ObjectFunctionPathNode) {
				if (currentPath.length === 1) {
					// TODO: Allow immidiate EEL-Helper (like "q(...)")
					continue
				}

				const methodNode = currentPath.pop()
				const eelHelperMethodNodePosition = new NodePosition(methodNode["position"].begin, methodNode["position"].begin + methodNode["value"].length)
				const eelHelperMethodNode = new EelHelperMethodNode(methodNode["value"], eelHelperMethodNodePosition)

				const position = new NodePosition(-1, -1)
				const nameParts = []
				for (const method of currentPath) {
					const value = method["value"]
					nameParts.push(value)
					if (position.start === -1) position.start = method["position"].begin
					position.end = method["position"].end
				}

				const eelHelperIdentifier = nameParts.join(".")
				for (const eelHelper of eelHelperTokens) {
					if (eelHelper.name === eelHelperIdentifier) {
						const method = eelHelper.methods.find(method => method.name === methodNode["value"])
						if (!method) continue
						this.addNode(eelHelperMethodNode, text)
						const eelHelperNode = new EelHelperNode(eelHelperIdentifier, eelHelperMethodNode, position)
						this.addNode(eelHelperNode, text)
					}
				}
			}
		}
	}

	handleTagNameNode(node: TagNode, text: string) {
		const prototypePath = new PrototypePathSegment(node["name"], new NodePosition(
			node["position"].begin + 1,
			node["position"].begin + 1 + node["name"].length
		))
		this.addNode(prototypePath, text)

		if (node["selfClosing"] || node["end"] === undefined) return

		const endOffset = node["end"]["name"].indexOf(node["name"])
		const endPrototypePath = new PrototypePathSegment(node["name"], new NodePosition(
			node["end"]["position"].begin + endOffset,
			node["end"]["position"].begin + endOffset + node["name"].length
		))
		this.addNode(endPrototypePath, text)
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

	clear() {
		this.tokens = []
		this.prototypeCreations = []
		this.prototypeOverwrites = []
		this.prototypeExtends = []
		this.nodesByLine = {}
		this.nodesByType = new Map()
	}

	createNodeByLine(node: AbstractNode, text: string) {
		return new LinePositionedNode(node, text)
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
				// console.log("pushing to overwrite: ", firstPathSegment.identifier)
			}
		} else if (firstPathSegment instanceof PathSegment) {
			this.addNode(firstPathSegment, text)
		} else if (operation instanceof ValueAssignment) {
			if (operation.pathValue instanceof FusionObjectValue) {
				// console.log(operation.pathValue)
			}
		}

		if (statement.block !== undefined) {
			this.readStatementList(statement.block.statementList, text)
		}
	}

	getNodeByLineAndColumn(line: number, column: number): LinePositionedNode<any> | undefined {
		const lineNodes = this.nodesByLine[line]
		if (lineNodes === undefined) return undefined
		const foundNodesByWeight: { [key: number]: LinePositionedNode<AbstractNode> } = {}
		for (const lineNode of lineNodes) {
			if (column >= lineNode.getBegin().column && column <= lineNode.getEnd().column) {
				const node = lineNode.getNode()
				let weight = 0
				switch (true) {
					case node instanceof ObjectPathNode:
						weight = 15
						break
					case node instanceof ObjectStatement:
						weight = 10
						break
					case node instanceof EelHelperMethodNode:
						weight = 25
						break
					case node instanceof EelHelperNode:
						weight = 20
						break
					case node instanceof FusionObjectValue:
						weight = 30
						break
				}
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