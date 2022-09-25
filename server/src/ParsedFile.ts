import * as NodeFs from "fs"
import * as NodePath from "path"
import { ObjectTreeParser } from 'ts-fusion-parser'
import { AbstractNode } from 'ts-fusion-parser/out/core/objectTreeParser/ast/AbstractNode'
import { DslExpressionValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/DslExpressionValue'
import { FusionObjectValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/FusionObjectValue'
import { NodePosition } from 'ts-fusion-parser/out/core/objectTreeParser/ast/NodePosition'
import { ObjectStatement } from 'ts-fusion-parser/out/core/objectTreeParser/ast/ObjectStatement'
import { PrototypePathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PrototypePathSegment'
import { StatementList } from 'ts-fusion-parser/out/core/objectTreeParser/ast/StatementList'
import { ValueAssignment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/ValueAssignment'
import { ValueCopy } from 'ts-fusion-parser/out/core/objectTreeParser/ast/ValueCopy'
import { AttributeToken, ClosingTagToken, OpeningTagToken, Token, Tokenizer } from './html'
import { getlineNumberOfChar } from './util'

export interface NodeByLine<T> {
	node: T
	startColumn: number
	endColumn: number,
	line: number
}

export class ParsedFile {
	public uri: string
	public tokens: any[] = []

	public prototypeCreations: NodeByLine<any>[] = []
	public prototypeOverwrites: NodeByLine<any>[] = []

	public nodesByLine: {[key: string]: NodeByLine<AbstractNode>[]} = {}
	public nodesByType: Map<any, NodeByLine<AbstractNode>[]> = new Map()

	public ignoredDueToError = false
	public igoredErrorsByParser: Error[] = []

	constructor(uri: string) {
		this.uri = uri
	}

	init(text: string = undefined) {
		try {
			if(text === undefined) {
				const file = NodeFs.readFileSync(this.uri.replace("file://", ""));
				text = file.toString()
			}
			
			const objectTree = ObjectTreeParser.parse(text, undefined, true)
			this.igoredErrorsByParser = objectTree.errors
			this.readStatementList(objectTree.statementList, text)

			for(const nodeType of objectTree.nodesByType.keys()) {
				for(const node of objectTree.nodesByType.get(nodeType)) {
					if(node instanceof DslExpressionValue) {
						this.handleAfxDsl(node, text)
						continue
					}
					this.addNode(node, text)
				}
			}
			return true
		} catch(e) {
			console.log("Caught")
			return false
		}
	}

	addNode(node: AbstractNode, text: string) {
		if(node["position"] === undefined) return
		const nodeByLine = this.createNodeByLine(node, text)
		if(this.nodesByLine[nodeByLine.line] === undefined) {
			this.nodesByLine[nodeByLine.line] = []
		}
		this.nodesByLine[nodeByLine.line].push(nodeByLine)
		this.addToNodeByType(node.constructor, nodeByLine)
	}

	handleAfxDsl(node: DslExpressionValue, text: string) {
		const locationOffset = node["position"].start + node.identifier.length + 1 // id + `
		if(node.identifier !== "afx") return

		for(const htmlToken of Tokenizer.tokenize(node.code)) {
			switch(htmlToken.type) {
				case "opening-tag":
				case "closing-tag":
					this.handleAfxTagName(locationOffset, htmlToken, text)
					break;
				case "attribute":
					this.handleAfxAttribute(locationOffset, htmlToken, text)
					break;
				default:
					break;
			}
		}
	}

	handleAfxTagName(locationOffset: number, htmlToken: OpeningTagToken|ClosingTagToken, text: string) {
		if(!htmlToken.name.includes(":")) return
		const startPos = locationOffset + htmlToken.startPos + (htmlToken.type === "opening-tag" ? 1 : 2)
		const endPos = locationOffset + htmlToken.endPos + (htmlToken.type === "opening-tag" ? 0 : -1)
		const node = new FusionObjectValue(htmlToken.name, new NodePosition(startPos, endPos))

		this.addNode(node, text)
	}

	handleAfxAttribute(locationOffset: number, htmlToken: AttributeToken, text: string) {
		if(!(htmlToken.value.startsWith("{") && htmlToken.value.endsWith("}"))) return
		// TODO: handle EEL in atributes. 
	}

	protected addToNodeByType(type: any, node: NodeByLine<AbstractNode>) {
		const nodesWithType = this.nodesByType.get(type) ?? []
		nodesWithType.push(node)
		this.nodesByType.set(type, nodesWithType)
	}

	clear() {
		this.tokens = []
		this.prototypeCreations = []
		this.prototypeOverwrites = []
		this.nodesByLine = {}
		this.nodesByType = new Map()
	}

	createNodeByLine(node: AbstractNode, text: string) {
		const textStartPosition = getlineNumberOfChar(text, node["position"].start)
		return {
			node,
			startColumn: textStartPosition.column,
			endColumn: getlineNumberOfChar(text, node["position"].end).column,
			line: textStartPosition.line
		}
	}

	readStatementList(statementList: StatementList, text: string) {
		for(const rootStatement of statementList.statements) {
			if(rootStatement instanceof ObjectStatement) {
				this.readObjectStatement(rootStatement, text)
			} else {
				// console.log(rootStatement)
			}
		}
	}

	readObjectStatement(statement: ObjectStatement, text: string) {
		const firstPathSegment = statement.path.segments[0]
		if(firstPathSegment instanceof PrototypePathSegment) {
			const nodeByLine = this.createNodeByLine(firstPathSegment, text)
			if(statement.operation instanceof ValueCopy) {
				this.prototypeCreations.push(nodeByLine)
			} else {
				this.prototypeOverwrites.push(nodeByLine)
				// console.log("pushing to overwrite: ", firstPathSegment.identifier)
			}
		} else if(statement.operation instanceof ValueAssignment){
			if(statement.operation.pathValue instanceof FusionObjectValue) {
				// console.log(statement.operation.pathValue)
			}
		}

		if(statement.block !== undefined) {
			this.readStatementList(statement.block.statementList, text)
		}
	}

	getNodeByLineAndColumn(line: number, column): NodeByLine<any>|undefined {
		const lineNodes = this.nodesByLine[line]
		if(lineNodes === undefined) return undefined
		for(const lineNode of lineNodes) {
			if(column >= lineNode.startColumn && column <= lineNode.endColumn) {
				return lineNode
			}
		}
		return undefined
	}
}