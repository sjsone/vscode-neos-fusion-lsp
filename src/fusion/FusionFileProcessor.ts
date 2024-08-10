import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { NodePosition } from 'ts-fusion-parser/out/common/NodePosition'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { LiteralStringNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { FusionFile } from 'ts-fusion-parser/out/fusion/nodes/FusionFile'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/nodes/MetaPathSegment'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { StatementList } from 'ts-fusion-parser/out/fusion/nodes/StatementList'
import { StringValue } from 'ts-fusion-parser/out/fusion/nodes/StringValue'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { ValueCopy } from 'ts-fusion-parser/out/fusion/nodes/ValueCopy'
import { ActionUriPartTypes, ActionUriService } from '../common/ActionUriService'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { Logger } from '../common/Logging'
import { NodeService } from '../common/NodeService'
import { findParent, getObjectIdentifier } from '../common/util'
import { NeosWorkspace } from '../neos/NeosWorkspace'
import { ParsedFusionFile } from './ParsedFusionFile'
import { ActionUriActionNode } from './node/ActionUriActionNode'
import { ActionUriControllerNode } from './node/ActionUriControllerNode'
import { ActionUriDefinitionNode } from './node/ActionUriDefinitionNode'
import { FqcnNode } from './node/FqcnNode'
import { NeosFusionFormActionNode } from './node/NeosFusionFormActionNode'
import { NeosFusionFormControllerNode } from './node/NeosFusionFormControllerNode'
import { NeosFusionFormDefinitionNode } from './node/NeosFusionFormDefinitionNode'
import { PhpClassMethodNode } from './node/PhpClassMethodNode'
import { PhpClassNode } from './node/PhpClassNode'
import { ResourceUriNode } from './node/ResourceUriNode'
import { TranslationShortHandNode } from './node/TranslationShortHandNode'
import { RoutingControllerNode } from './node/RoutingControllerNode'
import { RoutingActionNode } from './node/RoutingActionNode'
import { FlowConfigurationPathNode } from './FlowConfigurationPathNode'
import { OperationNode } from 'ts-fusion-parser/out/dsl/eel/nodes/OperationNode'
import { PropertyDocumentationDefinition } from 'ts-fusion-parser/out/fusion/nodes/PropertyDocumentationDefinition'

declare module 'ts-fusion-parser/out/fusion/nodes/ObjectStatement' {
	interface ObjectStatement {
		documentationDefinition: PropertyDocumentationDefinition | undefined;
	}
}

type PostProcess = () => void
export class FusionFileProcessor extends Logger {
	protected parsedFusionFile: ParsedFusionFile
	protected postProcessors: PostProcess[] = []

	constructor(parsedFusionFile: ParsedFusionFile, suffix: string | undefined = undefined) {
		super(suffix)
		this.parsedFusionFile = parsedFusionFile
	}

	processNodes(objectTree: FusionFile, text: string) {
		for (const nodes of objectTree.nodesByType.values()) {
			for (const node of nodes) {
				if (node instanceof ObjectNode) this.processEelObjectNode(node, text)
				if (node instanceof TagNode) this.processTagNameNode(node, text)
				if (node instanceof TagAttributeNode) this.processTagAttributeNode(node, text)
				if (node instanceof ObjectStatement) this.processObjectStatement(node, text)
				if (node instanceof FusionObjectValue) this.processFusionObjectValue(node, text)
				if (node instanceof LiteralStringNode) this.processLiteralStringNode(node, text)
				if (node instanceof PropertyDocumentationDefinition) this.processPropertyDocumentationDefinition(node, text)
				this.parsedFusionFile.addNode(node, text)
			}
		}

		if (this.parsedFusionFile.uri.endsWith("Routing.fusion")) {
			for (const rootStatement of objectTree.statementList.statements) {
				if (!(rootStatement instanceof ObjectStatement)) continue

				const routingControllerNode = new RoutingControllerNode(rootStatement, getObjectIdentifier(rootStatement))
				this.parsedFusionFile.addNode(routingControllerNode, text)

				if (!rootStatement.block?.statementList.statements) continue
				for (const actionStatement of rootStatement.block.statementList.statements) {
					if (!(actionStatement instanceof ObjectStatement)) continue
					if (actionStatement.path.segments.length !== 1) continue
					const routingActionNode = new RoutingActionNode(routingControllerNode, actionStatement, getObjectIdentifier(actionStatement))
					this.parsedFusionFile.addNode(routingActionNode, text)
				}
			}
		}
	}

	runPostProcessing() {
		for (const postProcess of this.postProcessors) postProcess()
		this.postProcessors = []
	}

	protected processEelObjectNode(node: ObjectNode, text: string) {
		for (const {
			eelHelperNode,
			eelHelperMethodNode,
			eelHelperIdentifier
		} of FusionFileProcessor.ResolveEelHelpersForObjectNode(node, this.parsedFusionFile.workspace.neosWorkspace)) {
			this.parsedFusionFile.addNode(eelHelperMethodNode, text)
			this.parsedFusionFile.addNode(eelHelperNode, text)

			this.processTranslations(eelHelperIdentifier, eelHelperMethodNode, text)
			this.processPropTypesFqcn(eelHelperIdentifier, eelHelperMethodNode, text)
		}
	}

	static * ResolveEelHelpersForObjectNode(node: ObjectNode, neosWorkspace: NeosWorkspace) {
		const eelHelperTokens = neosWorkspace.getEelHelperTokens()

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
			if (!methodNode) continue

			const eelHelperMethodNodePosition = new NodePosition(methodNode.position.begin, methodNode.position.begin + methodNode.value.length)
			const eelHelperMethodNode = new PhpClassMethodNode(methodNode.value, part, eelHelperMethodNodePosition)

			const { position, eelHelperIdentifier } = FusionFileProcessor.createEelHelperIdentifierAndPositionFromPath(currentPath)
			for (const eelHelper of eelHelperTokens) {
				if (eelHelper.name !== eelHelperIdentifier) continue

				const method = eelHelper.methods.find(method => method.valid(methodNode.value))
				if (!method) continue

				const eelHelperNode = new PhpClassNode(eelHelperIdentifier, eelHelperMethodNode, node, position)

				yield {
					method,
					eelHelperNode, eelHelperMethodNode,
					eelHelperIdentifier
				}
			}
		}
	}

	protected processTranslations(identifier: string, methodNode: PhpClassMethodNode, text: string) {
		if (!(identifier === "I18n" || identifier === "Translation") || methodNode.identifier !== "translate") return
		if (!(methodNode.pathNode instanceof ObjectFunctionPathNode)) return
		if (methodNode.pathNode.args.length !== 1) return

		const firstArgument = methodNode.pathNode.args[0]
		if (!(firstArgument instanceof LiteralStringNode)) return

		const translationShortHandNode = new TranslationShortHandNode(firstArgument)
		this.parsedFusionFile.addNode(translationShortHandNode, text)
	}

	protected processPropTypesFqcn(identifier: string, methodNode: PhpClassMethodNode, text: string) {
		if (identifier !== "PropTypes" || methodNode.identifier.toLowerCase() !== "instanceof") return

		const pathNode = methodNode.pathNode
		if (!(pathNode instanceof ObjectFunctionPathNode)) return

		const firstArgument = pathNode.args[0]
		if (!(firstArgument instanceof LiteralStringNode)) return

		let fqcn = firstArgument.value.split("\\\\").join("\\")
		if (fqcn.startsWith("\\")) fqcn = fqcn.replace("\\", "")

		const classDefinition = this.parsedFusionFile.workspace.neosWorkspace.getClassDefinitionFromFullyQualifiedClassName(fqcn)
		if (classDefinition === undefined) return

		const fqcnNode = new FqcnNode(firstArgument.value, classDefinition, firstArgument.position)
		this.parsedFusionFile.addNode(fqcnNode, text)
	}

	protected static createEelHelperIdentifierAndPositionFromPath(path: ObjectPathNode[]) {
		const position = new NodePosition(-1, -1)
		const nameParts: string[] = []
		for (const method of path) {
			nameParts.push(method.value)
			if (position.begin === -1) position.begin = method.position.begin
			position.end = method.position.end
		}

		return {
			eelHelperIdentifier: nameParts.join("."),
			position
		}
	}

	protected createFlowConfigurationPathNode(functionNode: ObjectFunctionPathNode, text: string) {
		let configurationPath = functionNode.args[0]
		if (!(configurationPath instanceof LiteralStringNode)) {
			if (!(configurationPath instanceof OperationNode)) return
			const leftHand = configurationPath.leftHand
			if (!(leftHand instanceof LiteralStringNode)) return
			configurationPath = leftHand
		}

		const flowConfigurationPathNode = FlowConfigurationPathNode.FromLiteralStringNode(<LiteralStringNode>configurationPath)
		if (flowConfigurationPathNode) {
			this.parsedFusionFile.addNode(flowConfigurationPathNode, text)
			for (const pathPart of flowConfigurationPathNode["path"]) {
				this.parsedFusionFile.addNode(pathPart, text)
			}
		}
	}

	protected processTagNameNode(node: TagNode, text: string) {
		const identifier = node.name
		if (!identifier.includes(".") || !identifier.includes(":")) return

		const prototypePath = new PrototypePathSegment(identifier, new NodePosition(
			node.position.begin + 1,
			node.position.begin + 1 + identifier.length
		))

		prototypePath.parent = node
		this.parsedFusionFile.addNode(prototypePath, text)

		if (node.selfClosing || node.end === undefined) return

		const endOffset = node.end.name.indexOf(identifier)
		const endPrototypePath = new PrototypePathSegment(identifier, new NodePosition(
			node.end.position.begin + endOffset,
			node.end.position.begin + endOffset + identifier.length
		))

		endPrototypePath.parent = node
		this.parsedFusionFile.addNode(endPrototypePath, text)

		if (node.name === "Neos.Fusion.Form:Form") {
			const neosFusionFormDefinitionNode = new NeosFusionFormDefinitionNode(node)
			for (const attribute of node.attributes) {
				if (!(attribute instanceof TagAttributeNode)) continue
				if (!attribute.name.startsWith("form.target")) continue
				if (typeof attribute.value !== "string") continue

				if (attribute.name === "form.target.action") {
					const actionUriActionNode = new NeosFusionFormActionNode(attribute)
					neosFusionFormDefinitionNode.setAction(actionUriActionNode)
					this.parsedFusionFile.addNode(actionUriActionNode, text)
				}

				if (attribute.name === "form.target.controller") {
					const actionUriControllerNode = new NeosFusionFormControllerNode(attribute)
					neosFusionFormDefinitionNode.setController(actionUriControllerNode)
					this.parsedFusionFile.addNode(actionUriControllerNode, text)
				}
			}
			this.parsedFusionFile.addNode(neosFusionFormDefinitionNode, text)
		}
	}

	protected processTagAttributeNode(node: TagAttributeNode, text: string) {
		if (typeof node.value === "string") {
			const value = node.value.substring(1, node.value.length - 1)
			if (value.startsWith("resource://")) {
				const position: NodePosition = {
					begin: node.position.end - value.length - 1,
					end: node.position.end
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

		if (segments[0] instanceof PrototypePathSegment) {
			this.postProcessors.push(() => {
				const isPlugin = NodeService.isPrototypeOneOf((segments[0] as PrototypePathSegment)?.identifier, "Neos.Neos:Plugin", this.parsedFusionFile.workspace)
				if (isPlugin) this.processActionUriObjectStatement(objectStatement, text)
			})
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

		const begin = operation.pathValue.position.begin + operation.pathValue.value.indexOf(fqcn) + 1
		const position = {
			begin,
			end: begin + fqcn.length + 1
		}

		const fqcnNode = new FqcnNode(operation.pathValue.value, classDefinition, position)
		this.parsedFusionFile.addNode(fqcnNode, text)
	}

	protected processStringValue(stringValue: StringValue, text: string) {
		const value = stringValue.value
		if (value.startsWith("resource://")) {
			const resourceUriNode = new ResourceUriNode(value, stringValue.position)
			if (resourceUriNode) this.parsedFusionFile.addNode(resourceUriNode, text)
		}
	}

	protected processFusionObjectValue(fusionObjectValue: FusionObjectValue, text: string) {
		if (!ActionUriService.hasPrototypeNameActionUri(fusionObjectValue.value, this.parsedFusionFile.workspace)) return
		const objectStatement = findParent(fusionObjectValue, ObjectStatement)
		if (!objectStatement) return

		this.processActionUriObjectStatement(objectStatement, text)
	}

	protected processActionUriObjectStatement(objectStatement: ObjectStatement, text: string) {
		if (objectStatement.block === undefined) return

		const actionUriDefinitionNode = new ActionUriDefinitionNode(objectStatement)

		for (const statement of objectStatement.block.statementList.statements) {
			if (!(statement instanceof ObjectStatement)) continue
			if (!(statement.operation instanceof ValueAssignment)) continue
			if (!(statement.operation.pathValue instanceof StringValue)) continue

			if (getObjectIdentifier(statement) === ActionUriPartTypes.Action) {
				const actionUriActionNode = new ActionUriActionNode(statement, statement.operation.pathValue)
				actionUriDefinitionNode.setAction(actionUriActionNode)
				this.parsedFusionFile.addNode(actionUriActionNode, text)
			}

			if (getObjectIdentifier(statement) === ActionUriPartTypes.Controller) {
				const actionUriControllerNode = new ActionUriControllerNode(statement, statement.operation.pathValue)
				actionUriDefinitionNode.setController(actionUriControllerNode)
				this.parsedFusionFile.addNode(actionUriControllerNode, text)
			}
		}

		this.parsedFusionFile.addNode(actionUriDefinitionNode, text)
	}

	protected processLiteralStringNode(literalStringNode: LiteralStringNode, text: string) {
		const value = literalStringNode.value
		if (value.startsWith("resource://")) {
			const resourceUriNode = new ResourceUriNode(value, literalStringNode.position)
			if (resourceUriNode) this.parsedFusionFile.addNode(resourceUriNode, text)
		}

		if (value.startsWith('[instanceof ') && value.endsWith(']')) {
			const instanceofRegex = /(?:\[instanceof (.+?)\])+/gm
			let result: RegExpExecArray | null
			while ((result = instanceofRegex.exec(value)) !== null) {
				const prototypeName = result[1]
				const begin = literalStringNode.position.begin + value.indexOf(prototypeName, result.index) + 1
				const position = {
					begin,
					end: begin + prototypeName.length
				}

				if (prototypeName.startsWith('\\')) {
					const fqcn = prototypeName.slice(1).split("\\\\").join("\\")
					const classDefinition = this.parsedFusionFile.workspace.neosWorkspace.getClassDefinitionFromFullyQualifiedClassName(fqcn)
					if (classDefinition === undefined) continue
					const fqcnNode = new FqcnNode(prototypeName, classDefinition, position)
					this.parsedFusionFile.addNode(fqcnNode, text)
				} else {
					const prototypePath = new PrototypePathSegment(prototypeName, position)
					if (!prototypePath) continue
					prototypePath.parent = literalStringNode
					this.parsedFusionFile.addNode(prototypePath, text)
				}
			}
		}
	}

	protected processPropertyDocumentationDefinition(node: PropertyDocumentationDefinition, text: string) {
		const FusionObjectNameRegex = /[A-Z][0-9a-zA-Z.]+(?::[0-9a-zA-Z.]+)+/gm

		const nextStatement = node.findNextStatement()
		if (nextStatement) {
			nextStatement.documentationDefinition = node
		}

		const type = node.type;
		let m = FusionObjectNameRegex.exec(type)
		let runAwayPrevention = 0;
		while (m && runAwayPrevention++ < 100) {
			const prototypeName = m[0]

			const begin = node.position.begin + '/// '.length + m.index
			const position = {
				begin,
				end: begin + prototypeName.length
			}

			const prototypePath = new PrototypePathSegment(prototypeName, position)
			if (!prototypePath) continue
			prototypePath.parent = node
			this.parsedFusionFile.addNode(prototypePath, text)

			m = FusionObjectNameRegex.exec(type)
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