import * as NodeFs from 'fs'

import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { Position, Range } from 'vscode-languageserver'
import { DefinitionLink, Location, LocationLink } from 'vscode-languageserver/node'
import { ActionUriPartTypes, ActionUriService } from '../common/ActionUriService'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { XLIFFService } from '../common/XLIFFService'
import { findParent, getObjectIdentifier, getPrototypeNameFromNode, pathToUri } from '../common/util'
import { FlowConfigurationPathPartNode } from '../fusion/FlowConfigurationPathPartNode'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { ActionUriActionNode } from '../fusion/node/ActionUriActionNode'
import { ActionUriControllerNode } from '../fusion/node/ActionUriControllerNode'
import { FqcnNode } from '../fusion/node/FqcnNode'
import { NeosFusionFormActionNode } from '../fusion/node/NeosFusionFormActionNode'
import { NeosFusionFormControllerNode } from '../fusion/node/NeosFusionFormControllerNode'
import { PhpClassMethodNode } from '../fusion/node/PhpClassMethodNode'
import { PhpClassNode } from '../fusion/node/PhpClassNode'
import { ResourceUriNode } from '../fusion/node/ResourceUriNode'
import { RoutingActionNode } from '../fusion/node/RoutingActionNode'
import { RoutingControllerNode } from '../fusion/node/RoutingControllerNode'
import { TranslationShortHandNode } from '../fusion/node/TranslationShortHandNode'
import { ClassDefinition } from '../neos/NeosPackageNamespace'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext'
import { NodeService } from '../common/NodeService'

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
			case node instanceof FlowConfigurationPathPartNode:
				return this.getConfigurationSettingsDefinitions(workspace, <LinePositionedNode<FlowConfigurationPathPartNode>>foundNodeByLine)
			case node instanceof TranslationShortHandNode:
				return this.getTranslationShortHandNodeDefinitions(workspace, <LinePositionedNode<TranslationShortHandNode>>foundNodeByLine)
			case node instanceof FusionObjectValue:
			case node instanceof PrototypePathSegment:
				return this.getPrototypeDefinitions(workspace, foundNodeByLine)
			case node instanceof PathSegment:
				return this.getPropertyDefinitions(parsedFile, workspace, <LinePositionedNode<PathSegment>>foundNodeByLine)
			case node instanceof ObjectPathNode:
				return this.getPropertyDefinitions(parsedFile, workspace, <LinePositionedNode<ObjectPathNode>>foundNodeByLine)
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

			locations.push(LocationLink.create(translationFile.uri, range, range, foundNodeByLine.getPositionAsRange()))
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
				locations.push(LocationLink.create(
					otherParsedFile.uri,
					otherNode.getPositionAsRange(),
					otherNode.getPositionAsRange(),
					foundNodeByLine.getPositionAsRange()
				))
			}
		}

		return locations
	}

	getPropertyDefinitions(parsedFile: ParsedFusionFile, workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<ObjectPathNode | PathSegment>, debug = false): null | Location[] {
		const node = foundNodeByLine.getNode()

		const relevantParentType = node instanceof ObjectPathNode ? ObjectNode : ObjectStatement

		const objectNodeOrStatement = findParent(node, relevantParentType)
		if (!objectNodeOrStatement) return null
		// console.log("found object")
		const segment = NodeService.findPropertyDefinitionSegment(objectNodeOrStatement, workspace, true, false)
		if (!segment) return null
		// console.log("got segment")

		const firstSegment = segment.statement.path.segments[0]
		return [{
			uri: firstSegment.fileUri,
			range: firstSegment.linePositionedNode.getPositionAsRange()
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

		const prototypeFusionContext = NodeService.getFusionContextOfPrototype(tagNode.name, workspace)
		if (!prototypeFusionContext) return []

		for (const propertyName in prototypeFusionContext) {
			if (propertyName !== node.name) continue

			const nodes: undefined | Array<AbstractNode> = prototypeFusionContext?.[propertyName].__nodes
			if (!nodes) continue

			for (const node of nodes) {
				const statement = findParent(node, ObjectStatement)
				if (!statement) continue

				locationLinks.unshift({
					targetUri: statement.fileUri,
					targetRange: statement.linePositionedNode.getPositionAsRange(),
					targetSelectionRange: statement.linePositionedNode.getPositionAsRange(),
					originSelectionRange
				})

				// TODO: make it configurable if all definitions should be provided
				break
			}
		}

		locationLinks.forEach(l => console.log(l.targetUri));

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

	getConfigurationSettingsDefinitions(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<FlowConfigurationPathPartNode>) {
		const partNode = foundNodeByLine.getNode()
		const node = partNode.parent

		const partIndex = node["path"].indexOf(partNode)
		if (partIndex === -1) return []

		const pathParts = node["path"].slice(0, partIndex + 1)
		const searchPath = pathParts.map(part => part["value"]).join(".")
		this.logDebug("searching for ", searchPath)

		const nodeBegin = node.linePositionedNode.getBegin()
		const originSelectionRange = {
			start: Position.create(nodeBegin.line, nodeBegin.character + 1),
			end: foundNodeByLine.getEnd()
		}

		// console.log("test", workspace.neosWorkspace.configurationManager.getMerged("Neos.Flow.core"))

		const locationLinks: LocationLink[] = []
		for (const result of workspace.neosWorkspace.configurationManager.search(searchPath)) {
			locationLinks.push({
				targetUri: result.file["uri"],
				targetRange: result.range,
				targetSelectionRange: result.range,
				originSelectionRange
			})
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