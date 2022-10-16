import * as NodeFs from "fs"
import * as NodePath from "path"
import { ObjectTreeParser } from 'ts-fusion-parser'
import { AbstractNode } from 'ts-fusion-parser/out/core/objectTreeParser/ast/AbstractNode'
import { DslExpressionValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/DslExpressionValue'
import { EelExpressionValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/EelExpressionValue'
import { FusionObjectValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/FusionObjectValue'
import { NodePosition } from 'ts-fusion-parser/out/core/objectTreeParser/ast/NodePosition'
import { ObjectStatement } from 'ts-fusion-parser/out/core/objectTreeParser/ast/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PrototypePathSegment'
import { StatementList } from 'ts-fusion-parser/out/core/objectTreeParser/ast/StatementList'
import { ValueAssignment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/ValueAssignment'
import { ValueCopy } from 'ts-fusion-parser/out/core/objectTreeParser/ast/ValueCopy'
import { EelHelperNode } from './fusion/EelHelperNode'
import { FusionWorkspace } from './FusionWorkspace'
import { AttributeToken, ClosingTagToken, OpeningTagToken, TextToken, Tokenizer } from './html'
import { LinePositionedNode } from './LinePositionedNode'

export class ParsedFile {
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

	constructor(uri: string, workspace: FusionWorkspace) {
		this.uri = uri
		this.workspace = workspace
	}

	init(text: string = undefined) {
		try {
			if (text === undefined) {
				const file = NodeFs.readFileSync(this.uri.replace("file://", ""));
				text = file.toString()
			}

			const objectTree = ObjectTreeParser.parse(text, undefined, true)
			this.igoredErrorsByParser = objectTree.errors
			this.readStatementList(objectTree.statementList, text)

			for (const nodeType of objectTree.nodesByType.keys()) {
				for (const node of objectTree.nodesByType.get(nodeType)) {
					if (node instanceof DslExpressionValue) {
						this.handleAfxDsl(node, text)
						continue
					}
					if(node instanceof EelExpressionValue) {
						this.handleEelExpression(node, text)
						continue
					}
					this.addNode(node, text)
				}
			}
			return true
		} catch (e) {
			if(e instanceof Error) {
				console.log("Caught: ",e.message, e.stack)
			}
			
			return false
		}
	}

	getNodesByType<T extends AbstractNode>(type: new(...args: any) => T): LinePositionedNode<T>[]|undefined {
		return <LinePositionedNode<T>[]|undefined>this.nodesByType.get(type)
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

	handleAfxDsl(node: DslExpressionValue, text: string) {
		const locationOffset = node["position"].start + node.identifier.length + 1 // id + `
		if (node.identifier !== "afx") return

		for (const htmlToken of Tokenizer.tokenize(node.code)) {
			switch (htmlToken.type) {
				case "opening-tag":
				case "closing-tag":
					this.handleAfxTagName(locationOffset, htmlToken, text)
					break;
				case "attribute":
					this.handleAfxAttribute(locationOffset, htmlToken, text)
					break;
				case "text":
					this.handleAfxText(locationOffset , htmlToken, text)
					break;
				default:
					break;
			}
		}
	}

	handleAfxTagName(locationOffset: number, htmlToken: OpeningTagToken | ClosingTagToken, text: string) {
		if (!htmlToken.name.includes(":")) return
		const startPos = locationOffset + htmlToken.startPos + (htmlToken.type === "opening-tag" ? 1 : 2)
		const endPos = locationOffset + htmlToken.endPos + (htmlToken.type === "opening-tag" ? 0 : -1)
		const node = new FusionObjectValue(htmlToken.name, new NodePosition(startPos, endPos))

		this.addNode(node, text)
	}

	handleAfxAttribute(locationOffset: number, htmlToken: AttributeToken, text: string) {
		if (htmlToken.quote !== "{") return
		
		const txt = text.substring(locationOffset+htmlToken.startPos, locationOffset+htmlToken.endPos)
		const prefixRegex = /(.*=\s*{)/
		const offset = prefixRegex.exec(txt)[1].length
		const propsRegex = /props\.([a-zA-Z0-9]+)/g

		let lastIndex = offset
		let match = propsRegex.exec(txt);

		while (match != null) {
			const identifier = match[1]
			const identifierIndex = txt.substring(lastIndex).indexOf(identifier) + lastIndex

			const startPos = locationOffset+htmlToken.startPos + identifierIndex
			const endPos = locationOffset+htmlToken.startPos + identifierIndex + identifier.length

			const node = new PathSegment(identifier, new NodePosition(startPos, endPos))
			this.addNode(node, text)

			lastIndex = lastIndex + identifierIndex
			match = propsRegex.exec(txt);
		}
	}

	handleAfxText(locationOffset: number, htmlToken: TextToken, text: string) {
		const prefixRegex = /(\s*{)/
		const prefixResult = prefixRegex.exec(htmlToken.text)
		if(prefixResult === null) return 
		
		const prefix = prefixResult[1]
		const rest = htmlToken.text.substring(prefix.length)

		const propsRegex = /props\.([a-zA-Z0-9]+)/g

		const offset = prefix.length

		let lastIndex = offset
		let match = propsRegex.exec(rest);

		while (match != null) {
			const identifier = match[1]
			const identifierIndex = rest.substring(lastIndex).indexOf(identifier) + lastIndex

			const startPos = locationOffset+htmlToken.startPos - htmlToken.text.length + offset + "props.".length
			const endPos = startPos + identifier.length
			
			const node = new PathSegment(identifier, new NodePosition(startPos, endPos))
			this.addNode(node, text)

			lastIndex = lastIndex + identifierIndex
			match = propsRegex.exec(rest);
		}
	}

	handleEelExpression(node: EelExpressionValue, text: string) {
		for(const eelHelper of this.workspace.neosWorkspace.getEelHelperFileUris()) {
			const regex = new RegExp(eelHelper.regex, 'g')

			let lastIndex = 0
			const rest = node.value
			let match = regex.exec(rest);

			while (match != null) {
				const identifier = match[1]
				const method = match[2]
				const identifierIndex = rest.substring(lastIndex).indexOf(identifier) + lastIndex 

				const startPos = node["position"].start + identifierIndex
				const endPos = startPos + identifier.length + (method ? method.length : 0)
				
				const eelHelperNode = new EelHelperNode(identifier, method, new NodePosition(startPos, endPos))
				this.addNode(eelHelperNode, text)

				lastIndex = lastIndex + identifierIndex
				match = regex.exec(rest);
			}
		}
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
				if(sourceFusionPrototype instanceof PrototypePathSegment) {
					this.prototypeExtends.push(this.createNodeByLine(sourceFusionPrototype, text))
				}

			} else {
				this.prototypeOverwrites.push(nodeByLine)
				// console.log("pushing to overwrite: ", firstPathSegment.identifier)
			}
		} else if(firstPathSegment instanceof PathSegment) {
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
		const foundNodesByWeight: {[key: number]: LinePositionedNode<AbstractNode>} = {}
		for (const lineNode of lineNodes) {
			if (column >= lineNode.getBegin().column && column <= lineNode.getEnd().column) {
				let weight = 0
				switch(true) {
					case lineNode.getNode() instanceof EelHelperNode:
						weight = 10;
						break;
				}
				if(foundNodesByWeight[weight] === undefined) {
					foundNodesByWeight[weight] = lineNode
				}
			}
		}

		const sortedKeys = Object.keys(foundNodesByWeight).sort((a, b) => parseInt(b) - parseInt(a))
		if(sortedKeys.length === 0) return undefined
		return foundNodesByWeight[sortedKeys[0]]
	}
}