import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { DslExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/DslExpressionValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { Location } from 'vscode-languageserver/node'
import { ActionUriPartTypes, ActionUriService } from '../common/ActionUriService'
import { LegacyNodeService } from '../common/LegacyNodeService'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { findParent } from '../common/util'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { ActionUriActionNode } from '../fusion/node/ActionUriActionNode'
import { ActionUriControllerNode } from '../fusion/node/ActionUriControllerNode'
import { PhpClassMethodNode } from '../fusion/node/PhpClassMethodNode'
import { PhpClassNode } from '../fusion/node/PhpClassNode'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext'

export interface ActionUriDefinition {
	package: string
	controller: string
	action: string
}

export class DefinitionCapability extends AbstractCapability {

	protected run(context: CapabilityContext<AbstractNode>) {
		const { workspace, parsedFile, foundNodeByLine } = <ParsedFileCapabilityContext<AbstractNode>>context
		if (!foundNodeByLine) return null

		const node = foundNodeByLine.getNode()

		this.logDebug(`node type "${foundNodeByLine.getNode().constructor.name}"`)
		switch (true) {
			case node instanceof PathSegment:
			case node instanceof ObjectPathNode:
				return this.getPropertyDefinitions(parsedFile, workspace, foundNodeByLine)
			case node instanceof PhpClassMethodNode:
				return this.getEelHelperMethodDefinitions(workspace, <LinePositionedNode<PhpClassMethodNode>>foundNodeByLine)
			case node instanceof PhpClassNode:
				return this.getEelHelperDefinitions(workspace, <LinePositionedNode<PhpClassNode>>foundNodeByLine)
			case node instanceof ObjectStatement:
				return this.getControllerActionDefinition(parsedFile, workspace, <LinePositionedNode<ObjectStatement>>foundNodeByLine, <ParsedFileCapabilityContext<AbstractNode>>context)
		}

		return null
	}

	getPropertyDefinitions(parsedFile: ParsedFusionFile, workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<AbstractNode>): null | Location[] {
		const node = <PathSegment | ObjectPathNode>foundNodeByLine.getNode()
		const objectNode = node.parent
		if (!(objectNode instanceof ObjectNode)) return null

		const isThisProperty = objectNode.path[0].value === "this"
		const isPropsProperty = objectNode.path[0].value === "props"

		if ((!isThisProperty && !isPropsProperty) || objectNode.path.length === 1) {
			// TODO: handle context properties
			return null
		}

		if (isThisProperty) {
			const isObjectNodeInDsl = findParent(node, DslExpressionValue) !== undefined
			// TODO: handle `this.foo` in AFX
			if (isObjectNodeInDsl) return null

			const objectStatement = findParent(objectNode, ObjectStatement)
			if (!objectStatement) return null
			const prototypeName = LegacyNodeService.findPrototypeName(objectStatement)
			if (!prototypeName) return null

			for (const property of LegacyNodeService.getInheritedPropertiesByPrototypeName(prototypeName, workspace)) {
				const firstPropertyPathSegment = property.statement.path.segments[0]
				if (firstPropertyPathSegment.identifier === objectNode.path[1].value) {
					return [{
						uri: property.uri!,
						range: firstPropertyPathSegment.linePositionedNode.getPositionAsRange()
					}]
				}
			}
			return null
		}

		const { foundIgnoreComment, foundIgnoreBlockComment } = LegacyNodeService.getSemanticCommentsNodeIsAffectedBy(objectNode, parsedFile)
		if (foundIgnoreComment) return [{
			uri: parsedFile.uri,
			range: foundIgnoreComment.getPositionAsRange()
		}]
		if (foundIgnoreBlockComment) return [{
			uri: parsedFile.uri,
			range: foundIgnoreBlockComment.getPositionAsRange()
		}]

		const segment = LegacyNodeService.findPropertyDefinitionSegment(objectNode, workspace, true)
		if (!segment) return null

		if (segment instanceof PathSegment) return [{
			uri: parsedFile.uri,
			range: segment.linePositionedNode.getPositionAsRange()
		}]

		return [{
			uri: segment.uri!,
			range: segment.statement.path.segments[0].linePositionedNode.getPositionAsRange()
		}]
	}

	getEelHelperDefinitions(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<PhpClassNode>) {
		const node = foundNodeByLine.getNode()
		for (const eelHelper of workspace.neosWorkspace.getEelHelperTokens()) {
			if (eelHelper.name === node.identifier) {
				return [{
					uri: eelHelper.uri,
					range: eelHelper.position
				}]
			}
		}

		return null
	}

	getEelHelperMethodDefinitions(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<PhpClassMethodNode>) {
		const node = foundNodeByLine.getNode()
		this.logVerbose(`Trying to find ${node.eelHelper.identifier}${node.identifier}`)
		for (const eelHelper of workspace.neosWorkspace.getEelHelperTokens()) {
			if (eelHelper.name === node.eelHelper.identifier) {
				const method = eelHelper.methods.find(method => method.valid(node.identifier))
				if (!method) continue
				return [{
					uri: eelHelper.uri,
					range: method.position
				}]
			}
		}

		return null
	}

	getControllerActionDefinition(parsedFile: ParsedFusionFile, workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<ObjectStatement>, context: ParsedFileCapabilityContext<AbstractNode>) {
		// TODO: Account for multiple action definitions as resolving cannot be a 100% certain
		const node = foundNodeByLine.getNode()
		if (!(node.operation instanceof ValueAssignment)) return null

		const foundNodes = parsedFile.getNodesByPosition(context.params.position)
		if (!foundNodes) return null

		const actionUriPartNode = <LinePositionedNode<ActionUriActionNode | ActionUriControllerNode>>foundNodes.find(positionedNode => (positionedNode.getNode() instanceof ActionUriActionNode || positionedNode.getNode() instanceof ActionUriControllerNode))
		if (actionUriPartNode === undefined) return null

		const actionUriDefinitionNode = actionUriPartNode.getNode().parent
		const definitionTargetName = actionUriPartNode.getNode() instanceof ActionUriControllerNode ? ActionUriPartTypes.Controller : ActionUriPartTypes.Action
		return ActionUriService.resolveActionUriDefinitionNode(node, actionUriDefinitionNode, definitionTargetName, workspace, parsedFile)
	}

}