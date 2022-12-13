import * as NodeFs from "fs"
import * as NodePath from "path"
import { ObjectTreeParser } from 'ts-fusion-parser'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { NodePosition } from 'ts-fusion-parser/out/common/NodePosition'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment'
import { StatementList } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/StatementList'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueAssignment'
import { ValueCopy } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueCopy'
import { PhpClassMethodNode } from './PhpClassMethodNode'
import { PhpClassNode } from './PhpClassNode'
import { FusionWorkspace } from './FusionWorkspace'
import { LinePositionedNode } from '../LinePositionedNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { findParent, getNodeWeight, isPrototypeDeprecated, uriToPath } from '../util'
import { Diagnostic, DiagnosticSeverity, DiagnosticTag } from 'vscode-languageserver'
import { DefinitionCapability } from '../capabilities/DefinitionCapability'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/MetaPathSegment'
import { StringValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/StringValue'
import { FqcnNode } from './FqcnNode'
import { ResourceUriNode } from './ResourceUriNode'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue'

export class ParsedFusionFile {
	public workspace: FusionWorkspace
	public uri: string
	public tokens: any[] = []

	public prototypeCreations: LinePositionedNode<PrototypePathSegment>[] = []
	public prototypeOverwrites: LinePositionedNode<PrototypePathSegment>[] = []
	public prototypeExtends: LinePositionedNode<AbstractNode>[] = []

	public nodesByLine: { [key: string]: LinePositionedNode<AbstractNode>[] } = {}
	public nodesByType: Map<new (...args: unknown[]) => AbstractNode, LinePositionedNode<AbstractNode>[]> = new Map()

	public ignoredDueToError = false
	public igoredErrorsByParser: Error[] = []

	protected debug: boolean

	constructor(uri: string, workspace: FusionWorkspace) {
		this.uri = uri
		this.workspace = workspace
		this.debug = this.uri.endsWith("Test.fusion")
	}

	init(text: string = undefined) {
		try {
			if (text === undefined) {
				text = NodeFs.readFileSync(uriToPath(this.uri)).toString()
			}

			const objectTree = ObjectTreeParser.parse(text, undefined, true)
			this.igoredErrorsByParser = objectTree.errors
			this.readStatementList(objectTree.statementList, text)

			for (const nodeType of objectTree.nodesByType.keys()) {
				for (const node of objectTree.nodesByType.get(nodeType)) {
					if (node instanceof ObjectNode) this.handleEelObjectNode(node, text)
					if (node instanceof TagNode) this.handleTagNameNode(node, text)
					if (node instanceof TagAttributeNode) this.handleTagAttributeNode(node, text)
					if (node instanceof ObjectStatement) this.handleObjectStatement(node, text)
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
		const eelHelperTokens = this.workspace.neosWorkspace.getEelHelperTokens()

		const currentPath: ObjectPathNode[] = []
		for (const part of node.path) {
			currentPath.push(part)
			const isLastPathPart = currentPath.length === node.path.length
			if (part instanceof ObjectFunctionPathNode || (isLastPathPart && (part instanceof ObjectPathNode))) {
				if (currentPath.length === 1) {
					// TODO: Allow immidiate EEL-Helper (like "q(...)")
					continue
				}

				const methodNode = currentPath.pop()
				const eelHelperMethodNodePosition = new NodePosition(methodNode["position"].begin, methodNode["position"].begin + methodNode["value"].length)
				const eelHelperMethodNode = new PhpClassMethodNode(methodNode["value"], part, eelHelperMethodNodePosition)

				const position = new NodePosition(-1, -1)
				const nameParts = []
				for (const method of currentPath) {
					const value = method["value"]
					nameParts.push(value)
					if (position.begin === -1) position.begin = method["position"].begin
					position.end = method["position"].end
				}

				const eelHelperIdentifier = nameParts.join(".")
				for (const eelHelper of eelHelperTokens) {
					if (eelHelper.name === eelHelperIdentifier) {
						const method = eelHelper.methods.find(method => method.valid(methodNode["value"]))
						if (!method) continue
						this.addNode(eelHelperMethodNode, text)
						const eelHelperNode = new PhpClassNode(eelHelperIdentifier, eelHelperMethodNode, node, position)
						this.addNode(eelHelperNode, text)
					}
				}
			}
		}
	}

	handleTagNameNode(node: TagNode, text: string) {
		const identifier = node["name"]
		if (!identifier.includes(".") || !identifier.includes(":")) return
		const prototypePath = new PrototypePathSegment(identifier, new NodePosition(
			node["position"].begin + 1,
			node["position"].begin + 1 + identifier.length
		))
		this.addNode(prototypePath, text)

		if (node["selfClosing"] || node["end"] === undefined) return

		const endOffset = node["end"]["name"].indexOf(identifier)
		const endPrototypePath = new PrototypePathSegment(identifier, new NodePosition(
			node["end"]["position"].begin + endOffset,
			node["end"]["position"].begin + endOffset + identifier.length
		))
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
				const resourceUriNode = new ResourceUriNode(value, position)
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
		// if(fqcn.endsWith("FormElementWrappingImplementation")) console.log("fqcn", fqcnNode)
		this.addNode(fqcnNode, text)
	}

	handleStringValue(stringValue: StringValue, text: string) {
		const value = stringValue.value
		if (value.startsWith("resource://")) {
			const resourceUriNode = new ResourceUriNode(value, stringValue["position"])
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
		const diagnostics: Diagnostic[] = []

		diagnostics.push(...this.diagnoseFusionProperties())
		diagnostics.push(...this.diagnoseResourceUris())
		diagnostics.push(...this.diagnoseTagNames())
		diagnostics.push(...this.diagnoseEelHelperArguments())
		diagnostics.push(...this.diagnosePrototypeNames())

		return diagnostics
	}

	protected diagnoseFusionProperties() {
		const diagnostics: Diagnostic[] = []

		const positionedObjectNodes = this.getNodesByType(ObjectNode)
		if (positionedObjectNodes === undefined) return diagnostics

		// TODO: Put logic of DefinitionCapability in a Provider/Service instead of using a Capability 
		const definitionCapability = new DefinitionCapability(this.workspace.languageServer)

		for (const positionedObjectNode of positionedObjectNodes) {
			const node = positionedObjectNode.getNode()
			const objectStatement = findParent(node, ObjectStatement)
			if (objectStatement === undefined) continue
			if (objectStatement.path.segments[0] instanceof MetaPathSegment) continue
			const pathBegin = node.path[0]["value"]
			if (pathBegin !== "props") continue
			if (node.path.length === 1) continue
			if (node.path[1]["value"] === "content") continue
			const definition = definitionCapability.getPropertyDefinitions(this, this.workspace, LinePositionedNode.Get(node.path[0]))
			if (definition) continue

			const objectStatementText = node.path.map(e => e["value"]).join(".")
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Warning,
				range: positionedObjectNode.getPositionAsRange(),
				message: `Could not resolve "${objectStatementText}"`,
				source: 'Fusion LSP'
			}
			diagnostics.push(diagnostic)
		}

		return diagnostics
	}

	protected diagnoseResourceUris() {
		const diagnostics: Diagnostic[] = []

		const resourceUriNodes = <LinePositionedNode<ResourceUriNode>[]>this.nodesByType.get(ResourceUriNode)
		if (resourceUriNodes === undefined) return diagnostics

		for (const resourceUriNode of resourceUriNodes) {
			const node = resourceUriNode.getNode()
			const identifier = node["identifier"]
			const uri = this.workspace.neosWorkspace.getResourceUriPath(node.getNamespace(), node.getRelativePath())
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Warning,
				range: resourceUriNode.getPositionAsRange(),
				message: ``,
				source: 'Fusion LSP'
			}
			if (!uri) {
				diagnostic.message = `Could not resolve package "${node.getNamespace()}"`
				diagnostics.push(diagnostic)
			} else if (!NodeFs.existsSync(uri)) {
				diagnostic.message = `Could not find file "${node.getRelativePath()}"`
				diagnostics.push(diagnostic)
			}
		}

		return diagnostics
	}

	protected diagnoseTagNames() {
		const diagnostics: Diagnostic[] = []

		const positionedTagNodes = this.getNodesByType(TagNode)
		if (positionedTagNodes === undefined) return diagnostics

		for (const positionedTagNode of positionedTagNodes) {
			const node = positionedTagNode.getNode()
			if (!node["selfClosing"]) continue
			if (node["end"]["name"] === "/>") continue
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: positionedTagNode.getPositionAsRange(),
				message: `Tags have to be closed`,
				source: 'Fusion LSP'
			}
			diagnostics.push(diagnostic)
		}
		return diagnostics
	}

	protected diagnoseEelHelperArguments() {
		const diagnostics: Diagnostic[] = []
		const positionedNodes = this.getNodesByType(PhpClassMethodNode)
		if (!positionedNodes) return diagnostics
		for (const positionedNode of positionedNodes) {
			const node = positionedNode.getNode()
			const pathNode = node.pathNode
			if (!(pathNode instanceof ObjectFunctionPathNode)) continue

			for (const eelHelper of this.workspace.neosWorkspace.getEelHelperTokens()) {
				if (eelHelper.name !== node.eelHelper.identifier) continue
				const method = eelHelper.methods.find(method => method.valid(node.identifier))
				if (!method) continue

				for (const parameterIndex in method.parameters) {
					const parameter = method.parameters[parameterIndex]
					if (parameter.defaultValue !== undefined) break
					if (pathNode.args[parameterIndex] === undefined) {
						const diagnostic: Diagnostic = {
							severity: DiagnosticSeverity.Error,
							range: positionedNode.getPositionAsRange(),
							message: `Missing argument`,
							source: 'Fusion LSP'
						}
						diagnostics.push(diagnostic)
					}
				}

				if (pathNode.args.length > method.parameters.length) {
					for (const exceedingArgument of pathNode.args.slice(method.parameters.length)) {
						const diagnostic: Diagnostic = {
							severity: DiagnosticSeverity.Warning,
							range: LinePositionedNode.Get(exceedingArgument).getPositionAsRange(),
							message: `Too many arguments provided`,
							source: 'Fusion LSP'
						}
						diagnostics.push(diagnostic)
					}
				}
			}
		}

		return diagnostics
	}

	diagnosePrototypeNames() {
		const diagnostics: Diagnostic[] = []

		const pathSegments = this.getNodesByType(PrototypePathSegment)
		if (pathSegments !== undefined) {
			for (const positionedPathSegment of pathSegments) {
				const node = positionedPathSegment.getNode()
				const range = positionedPathSegment.getPositionAsRange()
				if (!node.identifier.includes(":")) {
					diagnostics.push({
						severity: DiagnosticSeverity.Warning,
						range,
						tags: [DiagnosticTag.Deprecated],
						message: `A prototype without a namespace is deprecated`,
						source: 'Fusion LSP'
					})
				}
				if (isPrototypeDeprecated(this.workspace, node.identifier)) {
					diagnostics.push({
						severity: DiagnosticSeverity.Warning,
						range,
						tags: [DiagnosticTag.Deprecated],
						message: `Prototype ${node.identifier} is deprecated`,
						source: 'Fusion LSP'
					})
				}
			}
		}

		const fusionObjectValues = this.getNodesByType(FusionObjectValue)
		if (fusionObjectValues !== undefined) {
			for (const fusionObjectValue of fusionObjectValues) {
				const node = fusionObjectValue.getNode()
				const range = fusionObjectValue.getPositionAsRange()
				if (!node.value.includes(":")) {
					diagnostics.push({
						severity: DiagnosticSeverity.Warning,
						range,
						message: `Using a prototype without a namespace should be avoided`,
						source: 'Fusion LSP'
					})
				}
				const deprecated = isPrototypeDeprecated(this.workspace, node.value)
				if (deprecated !== false) {
					diagnostics.push({
						severity: DiagnosticSeverity.Warning,
						range,
						tags: [DiagnosticTag.Deprecated],
						message: `Prototype ${node.value} is deprecated.${deprecated !== true ? ` Use ${deprecated} instead.` : ''}`,
						source: 'Fusion LSP'
					})
				}
			}
		}

		return diagnostics
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
		return new LinePositionedNode<T>(node, text)
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