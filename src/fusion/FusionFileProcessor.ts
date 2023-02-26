import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode';
import { NodePosition } from 'ts-fusion-parser/out/common/NodePosition';
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode';
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode';
import { LiteralStringNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode';
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode';
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode';
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode';
import { FusionFile } from 'ts-fusion-parser/out/fusion/nodes/FusionFile';
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue';
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/nodes/MetaPathSegment';
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement';
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment';
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment';
import { StatementList } from 'ts-fusion-parser/out/fusion/nodes/StatementList';
import { StringValue } from 'ts-fusion-parser/out/fusion/nodes/StringValue';
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment';
import { ValueCopy } from 'ts-fusion-parser/out/fusion/nodes/ValueCopy';
import { LinePositionedNode } from '../common/LinePositionedNode';
import { Logger } from '../common/Logging';
import { findParent, getObjectIdentifier } from '../common/util';
import { ActionUriActionNode } from './ActionUriActionNode';
import { ActionUriControllerNode } from './ActionUriControllerNode';
import { ActionUriDefinitionNode } from './ActionUriDefinitionNode';
import { FqcnNode } from './FqcnNode';
import { ParsedFusionFile } from './ParsedFusionFile';
import { PhpClassMethodNode } from './PhpClassMethodNode';
import { PhpClassNode } from './PhpClassNode';
import { ResourceUriNode } from './ResourceUriNode';

export class FusionFileProcessor extends Logger {
	protected parsedFusionFile: ParsedFusionFile

	constructor(parsedFusionFile: ParsedFusionFile, suffix: string | undefined = undefined) {
		super(suffix)
		this.parsedFusionFile = parsedFusionFile
	}

	processNodesByType(nodeType: any, objectTree: FusionFile, text: string) {
		for (const node of objectTree.nodesByType.get(nodeType)) {
			if (node instanceof ObjectNode) this.processEelObjectNode(node, text)
			if (node instanceof TagNode) this.processTagNameNode(node, text)
			if (node instanceof TagAttributeNode) this.processTagAttributeNode(node, text)
			if (node instanceof ObjectStatement) this.processObjectStatement(node, text)
			if (node instanceof FusionObjectValue) this.processFusionObjectValue(node, text)
			if (node instanceof LiteralStringNode) this.processLiteralStringNode(node, text)
			this.parsedFusionFile.addNode(node, text)
		}
	}

	protected processEelObjectNode(node: ObjectNode, text: string) {
		const eelHelperTokens = this.parsedFusionFile.workspace.neosWorkspace.getEelHelperTokens()

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

				this.parsedFusionFile.addNode(eelHelperMethodNode, text)
				const eelHelperNode = new PhpClassNode(eelHelperIdentifier, eelHelperMethodNode, node, position)
				this.parsedFusionFile.addNode(eelHelperNode, text)
			}
		}
	}

	protected createEelHelperIdentifierAndPositionFromPath(path: ObjectPathNode[]) {
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

	protected processTagNameNode(node: TagNode, text: string) {
		const identifier = node["name"]
		if (!identifier.includes(".") || !identifier.includes(":")) return

		const prototypePath = new PrototypePathSegment(identifier, new NodePosition(
			node["position"].begin + 1,
			node["position"].begin + 1 + identifier.length
		))

		prototypePath["parent"] = node
		this.parsedFusionFile.addNode(prototypePath, text)

		if (node["selfClosing"] || node["end"] === undefined) return

		const endOffset = node["end"]["name"].indexOf(identifier)
		const endPrototypePath = new PrototypePathSegment(identifier, new NodePosition(
			node["end"]["position"].begin + endOffset,
			node["end"]["position"].begin + endOffset + identifier.length
		))

		endPrototypePath["parent"] = node
		this.parsedFusionFile.addNode(endPrototypePath, text)
	}

	protected processTagAttributeNode(node: TagAttributeNode, text: string) {
		if (typeof node.value === "string") {
			const value = node.value.substring(1, node.value.length - 1)
			if (value.startsWith("resource://")) {
				const position: NodePosition = {
					begin: node["position"].end - value.length - 1,
					end: node["position"].end
				}
				const resourceUriNode = new ResourceUriNode(value, position)
				if (resourceUriNode) this.parsedFusionFile.addNode(resourceUriNode, text)
			}

		}
		// this.parsedFusionFile.addNode(endPrototypePath, text)
	}

	protected processObjectStatement(objectStatement: ObjectStatement, text: string) {
		const segments = objectStatement.path.segments
		const metaPathSegment = segments[0] instanceof PrototypePathSegment ? segments[1] : segments[0]

		if (objectStatement.operation instanceof ValueAssignment) {
			if (metaPathSegment instanceof MetaPathSegment) return this.processMetaObjectStatement(objectStatement, metaPathSegment, text)
			if (objectStatement.operation.pathValue instanceof StringValue) return this.processStringValue(objectStatement.operation.pathValue, text)
		}
	}

	protected processMetaObjectStatement(objectStatement: ObjectStatement, metaPathSegment: MetaPathSegment, text: string) {
		if (!(metaPathSegment instanceof MetaPathSegment)) return
		if (metaPathSegment.identifier !== "class" && metaPathSegment.identifier !== "exceptionHandler") return
		const operation = <ValueAssignment>objectStatement.operation
		if (!(operation.pathValue instanceof StringValue)) return
		const fqcn = operation.pathValue.value.split("\\\\").join("\\")
		const classDefinition = this.parsedFusionFile.workspace.neosWorkspace.getClassDefinitionFromFullyQualifiedClassName(fqcn)
		if (classDefinition === undefined) return

		const fqcnNode = new FqcnNode(operation.pathValue.value, classDefinition, operation.pathValue["position"])
		this.parsedFusionFile.addNode(fqcnNode, text)
	}

	protected processStringValue(stringValue: StringValue, text: string) {
		const value = stringValue.value
		if (value.startsWith("resource://")) {
			const resourceUriNode = new ResourceUriNode(value, stringValue["position"])
			if (resourceUriNode) this.parsedFusionFile.addNode(resourceUriNode, text)
		}
	}

	protected processFusionObjectValue(fusionObjectValue: FusionObjectValue, text: string) {
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
				this.parsedFusionFile.addNode(actionUriActionNode, text)
			}

			if (getObjectIdentifier(statement) === "controller") {
				const actionUriControllerNode = new ActionUriControllerNode(statement, statement.operation.pathValue)
				actionUriDefinitionNode.setController(actionUriControllerNode)
				this.parsedFusionFile.addNode(actionUriControllerNode, text)
			}

		}
		this.parsedFusionFile.addNode(actionUriDefinitionNode, text)

	}

	protected processLiteralStringNode(literalStringNode: LiteralStringNode, text: string) {
		const value = literalStringNode["value"]
		if (value.startsWith("resource://")) {
			const resourceUriNode = new ResourceUriNode(value, literalStringNode["position"])
			if (resourceUriNode) this.parsedFusionFile.addNode(resourceUriNode, text)
		}
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

	protected readObjectStatement(statement: ObjectStatement, text: string) {
		const firstPathSegment = statement.path.segments[0]
		const operation = statement.operation
		if (firstPathSegment instanceof PrototypePathSegment) {
			const nodeByLine = this.createNodeByLine(firstPathSegment, text)
			if (operation instanceof ValueCopy) {
				this.parsedFusionFile.prototypeCreations.push(nodeByLine)

				const sourceFusionPrototype = operation.assignedObjectPath.objectPath.segments[0]
				if (sourceFusionPrototype instanceof PrototypePathSegment) {
					this.parsedFusionFile.prototypeExtends.push(this.createNodeByLine(sourceFusionPrototype, text))
				}

			} else {
				this.parsedFusionFile.prototypeOverwrites.push(nodeByLine)
			}
		} else if (firstPathSegment instanceof PathSegment) {
			this.parsedFusionFile.addNode(firstPathSegment, text)
		}

		if (statement.block !== undefined) {
			this.readStatementList(statement.block.statementList, text)
		}
	}

	protected createNodeByLine<T extends AbstractNode>(node: T, text: string) {
		return new LinePositionedNode<T>(node, text, this.parsedFusionFile.uri)
	}
}