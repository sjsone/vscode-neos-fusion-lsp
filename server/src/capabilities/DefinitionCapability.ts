import * as NodeFs from 'fs'

import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { DslExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/DslExpressionValue'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { DefinitionLink, Location, LocationLink, Position, Range } from 'vscode-languageserver/node'
import { ActionUriPartTypes, ActionUriService } from '../common/ActionUriService'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { NodeService } from '../common/NodeService'
import { XLIFFService } from '../common/XLIFFService'
import { findParent, getObjectIdentifier, getPrototypeNameFromNode, pathToUri } from '../common/util'
import { ActionUriActionNode } from '../fusion/node/ActionUriActionNode'
import { ActionUriControllerNode } from '../fusion/node/ActionUriControllerNode'
import { FqcnNode } from '../fusion/node/FqcnNode'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { NeosFusionFormActionNode } from '../fusion/node/NeosFusionFormActionNode'
import { NeosFusionFormControllerNode } from '../fusion/node/NeosFusionFormControllerNode'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { PhpClassMethodNode } from '../fusion/node/PhpClassMethodNode'
import { PhpClassNode } from '../fusion/node/PhpClassNode'
import { ResourceUriNode } from '../fusion/node/ResourceUriNode'
import { TranslationShortHandNode } from '../fusion/node/TranslationShortHandNode'
import { ClassDefinition } from '../neos/NeosPackageNamespace'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext'
import { RoutingActionNode } from '../fusion/node/RoutingActionNode'
import { RoutingControllerNode } from '../fusion/node/RoutingControllerNode'
import { toNamespacedPath } from 'path'

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

		this.logVerbose(`node type "${foundNodeByLine.getNode().constructor.name}"`)
		switch (true) {
			case node instanceof TranslationShortHandNode:
				return this.getTranslationShortHandNodeDefinitions(workspace, <LinePositionedNode<TranslationShortHandNode>>foundNodeByLine)
			case node instanceof FusionObjectValue:
			case node instanceof PrototypePathSegment:
				return this.getPrototypeDefinitions(workspace, foundNodeByLine)
			case node instanceof PathSegment:
			case node instanceof ObjectPathNode:
				return this.getPropertyDefinitions(parsedFile, workspace, foundNodeByLine)
			case node instanceof PhpClassMethodNode:
				return this.getEelHelperMethodDefinitions(workspace, <LinePositionedNode<PhpClassMethodNode>>foundNodeByLine)
			case node instanceof PhpClassNode:
				return this.getEelHelperDefinitions(workspace, <LinePositionedNode<PhpClassNode>>foundNodeByLine)
			case node instanceof FqcnNode:
				return this.getFqcnDefinitions(workspace, <LinePositionedNode<FqcnNode>>foundNodeByLine)
			case node instanceof ResourceUriNode:
				return this.getResourceUriPathNodeDefinition(workspace, <LinePositionedNode<ResourceUriNode>>foundNodeByLine)
			case node instanceof ObjectStatement:
				return this.getControllerActionDefinition(parsedFile, workspace, <LinePositionedNode<ObjectStatement>>foundNodeByLine, <ParsedFileCapabilityContext<AbstractNode>>context)
			case node instanceof TagAttributeNode:
				return this.getTagAttributeDefinition(parsedFile, workspace, <LinePositionedNode<TagAttributeNode>>foundNodeByLine, <ParsedFileCapabilityContext<TagAttributeNode>>context)
			case node instanceof RoutingControllerNode:
				return this.getRoutingControllerNode(parsedFile, workspace, <LinePositionedNode<RoutingControllerNode>>foundNodeByLine, <ParsedFileCapabilityContext<RoutingControllerNode>>context)
			case node instanceof RoutingActionNode:
				return this.getRoutingActionNode(parsedFile, workspace, <LinePositionedNode<RoutingActionNode>>foundNodeByLine, <ParsedFileCapabilityContext<RoutingActionNode>>context)
		}

		return null
	}

	async getTranslationShortHandNodeDefinitions(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<TranslationShortHandNode>) {
		const shortHandIdentifier = XLIFFService.readShortHandIdentifier(foundNodeByLine.getNode().getValue())
		const translationFiles = await XLIFFService.getMatchingTranslationFiles(workspace, shortHandIdentifier)

		const locations: DefinitionLink[] = []

		for (const translationFile of translationFiles) {
			const transUnit = await translationFile.getId(shortHandIdentifier.translationIdentifier)
			if (!transUnit) continue

			const position = transUnit.position
			const range = Range.create(
				position,
				Position.create(position.line, position.character + transUnit.id.length + 5)
			)

			locations.push({
				targetUri: translationFile.uri,
				targetRange: range,
				targetSelectionRange: range,
				originSelectionRange: foundNodeByLine.getPositionAsRange()
			})

		}
		return locations

	}

	getPrototypeDefinitions(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<AbstractNode>) {
		const goToPrototypeName = getPrototypeNameFromNode(foundNodeByLine.getNode())
		if (goToPrototypeName === "") {
			this.logDebug("No PrototypeName found for this node")
			return null
		}

		const locations: DefinitionLink[] = []

		for (const otherParsedFile of workspace.parsedFiles) {
			for (const otherNode of [...otherParsedFile.prototypeCreations, ...otherParsedFile.prototypeOverwrites]) {
				if (otherNode.getNode().identifier !== goToPrototypeName) continue
				locations.push({
					targetUri: otherParsedFile.uri,
					targetRange: otherNode.getPositionAsRange(),
					targetSelectionRange: otherNode.getPositionAsRange(),
					originSelectionRange: foundNodeByLine.getPositionAsRange()
				})
			}
		}

		return locations
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

			const prototypeName = NodeService.findPrototypeName(objectStatement)
			if (!prototypeName) return null

			for (const property of NodeService.getInheritedPropertiesByPrototypeName(prototypeName, workspace)) {
				if (!property.uri) continue

				const firstPropertyPathSegment = property.statement.path.segments[0]
				if (firstPropertyPathSegment.identifier === objectNode.path[1].value) {
					return [{
						uri: property.uri,
						range: firstPropertyPathSegment.linePositionedNode.getPositionAsRange()
					}]
				}
			}
			return null
		}

		const { foundIgnoreComment, foundIgnoreBlockComment } = NodeService.getSemanticCommentsNodeIsAffectedBy(objectNode, parsedFile)
		if (foundIgnoreComment) return [{
			uri: parsedFile.uri,
			range: foundIgnoreComment.getPositionAsRange()
		}]
		if (foundIgnoreBlockComment) return [{
			uri: parsedFile.uri,
			range: foundIgnoreBlockComment.getPositionAsRange()
		}]

		const segment = NodeService.findPropertyDefinitionSegment(objectNode, workspace, true)
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

	getFqcnDefinitions(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<FqcnNode>) {
		const classDefinition: ClassDefinition = foundNodeByLine.getNode().classDefinition
		if (classDefinition === undefined) return null

		return [{
			targetUri: classDefinition.uri,
			targetRange: classDefinition.position,
			targetSelectionRange: classDefinition.position,
			originSelectionRange: {
				start: foundNodeByLine.getBegin(),
				end: {
					character: foundNodeByLine.getBegin().character + foundNodeByLine.getNode().realLength,
					line: foundNodeByLine.getBegin().line
				}
			}
		}]
	}

	getResourceUriPathNodeDefinition(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<ResourceUriNode>) {
		const node = foundNodeByLine.getNode()
		if (!node.canBeFound()) {
			this.logDebug("ResourceURI cannot be found")
			return null
		}
		const path = workspace.neosWorkspace.getResourceUriPath(node.getNamespace(), node.getRelativePath())
		if (!path || !NodeFs.existsSync(path)) {
			this.logDebug(`Resource path path is "${path}" with node.namespace "${node.getNamespace()}" and node.relativePath "${node.getRelativePath()}"`)
			return null
		}

		const targetRange = {
			start: { line: 0, character: 0 },
			end: { line: 0, character: 0 },
		}

		const uri = pathToUri(path)
		this.logDebug(`Resource path path is "${path}" and uri is "${uri}"`)

		return [{
			targetUri: uri,
			targetRange: targetRange,
			targetSelectionRange: targetRange,
			originSelectionRange: foundNodeByLine.getPositionAsRange()
		}]
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


	getTagAttributeDefinition(parsedFile: ParsedFusionFile, workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<TagAttributeNode>, context: ParsedFileCapabilityContext<TagAttributeNode>): null | LocationLink[] {
		const node = foundNodeByLine.getNode()
		const tagNode = findParent(node, TagNode)
		if (!tagNode) return []

		const locationLinks: LocationLink[] = []
		const nodePositionBegin = foundNodeByLine.getBegin()
		const originSelectionRange = {
			start: nodePositionBegin,
			end: {
				line: nodePositionBegin.line,
				character: nodePositionBegin.character + node.name.length
			}
		}

		for (const property of NodeService.getInheritedPropertiesByPrototypeName(tagNode.name, workspace, true)) {
			if (getObjectIdentifier(property.statement) !== node.name) continue
			if (!property.uri) continue

			locationLinks.push({
				targetUri: property.uri,
				targetRange: property.statement.linePositionedNode.getPositionAsRange(),
				targetSelectionRange: property.statement.linePositionedNode.getPositionAsRange(),
				originSelectionRange
			})
		}

		const foundNodes = parsedFile.getNodesByPosition(context.params.position)
		if (!foundNodes) return locationLinks

		const neosFusionFormPartNode = <LinePositionedNode<NeosFusionFormActionNode | NeosFusionFormControllerNode>>foundNodes.find(positionedNode => (positionedNode.getNode() instanceof NeosFusionFormActionNode || positionedNode.getNode() instanceof NeosFusionFormControllerNode))
		if (neosFusionFormPartNode !== undefined) {
			const neosFusionFormDefinitionNode = neosFusionFormPartNode.getNode().parent

			const definitionTargetName = neosFusionFormPartNode.getNode() instanceof NeosFusionFormActionNode ? ActionUriPartTypes.Action : ActionUriPartTypes.Controller

			const resolvedDefinition = ActionUriService.resolveFusionFormDefinitionNode(node, neosFusionFormDefinitionNode, definitionTargetName, workspace, parsedFile)
			if (resolvedDefinition) locationLinks.push(...resolvedDefinition)
		}

		return locationLinks
	}

	getRoutingControllerNode(parsedFile: ParsedFusionFile, workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<RoutingControllerNode>, context: ParsedFileCapabilityContext<RoutingControllerNode>): null | LocationLink {
		const node = foundNodeByLine.getNode()

		const classDefinition = RoutingControllerNode.getClassDefinitionFromRoutingControllerNode(parsedFile, workspace, node)
		if (!classDefinition) return null

		return {
			targetUri: classDefinition.uri,
			originSelectionRange: node.linePositionedNode.getPositionAsRange(),
			targetRange: classDefinition.position,
			targetSelectionRange: classDefinition.position
		}
	}

	getRoutingActionNode(parsedFile: ParsedFusionFile, workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<RoutingActionNode>, context: ParsedFileCapabilityContext<RoutingActionNode>): null | Location {
		const node = foundNodeByLine.getNode()

		const classDefinition = RoutingControllerNode.getClassDefinitionFromRoutingControllerNode(parsedFile, workspace, node.parent)
		if (!classDefinition) return null

		const actionName = node.name + "Action"
		for (const method of classDefinition.methods) {
			if (method.name !== actionName) continue

			return {
				uri: classDefinition.uri,
				range: method.position
			}
		}

		return null
	}


}