import * as NodeFs from 'fs'

import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { DefinitionLink, Location, LocationLink } from 'vscode-languageserver/node'
import { PhpClassMethodNode } from '../fusion/PhpClassMethodNode'
import { PhpClassNode } from '../fusion/PhpClassNode'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { findParent, findUntil, getObjectIdentifier, getPrototypeNameFromNode } from '../common/util'
import { AbstractCapability } from './AbstractCapability'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { NodeService } from '../common/NodeService'
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { FqcnNode } from '../fusion/FqcnNode'
import { ClassDefinition } from '../neos/NeosPackageNamespace'
import { ResourceUriNode } from '../fusion/ResourceUriNode'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { StringValue } from 'ts-fusion-parser/out/fusion/nodes/StringValue'
import { ValueCopy } from 'ts-fusion-parser/out/fusion/nodes/ValueCopy'
import { ActionUriActionNode } from '../fusion/ActionUriActionNode'
import { ActionUriDefinitionNode } from '../fusion/ActionUriDefinitionNode'
import { ActionUriControllerNode } from '../fusion/ActionUriControllerNode'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'

export interface ActionUriDefinition {
	package: string
	controller: string
	action: string
}

export class DefinitionCapability extends AbstractCapability {

	protected run(context: CapabilityContext<AbstractNode>) {
		const { workspace, parsedFile, foundNodeByLine } = <ParsedFileCapabilityContext<AbstractNode>>context
		const node = foundNodeByLine.getNode()

		// TODO: handle afx TagNodeAttribute like `<Vendor.Site:Thing text={props.test} />`. `text` should be clickable
		this.logVerbose(`node type "${foundNodeByLine.getNode().constructor.name}"`)
		switch (true) {
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
		}

		return null
	}

	getPrototypeDefinitions(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<AbstractNode>) {
		const goToPrototypeName = getPrototypeNameFromNode(foundNodeByLine.getNode())
		if (goToPrototypeName === "") return null

		const locations: DefinitionLink[] = []

		for (const otherParsedFile of workspace.parsedFiles) {
			for (const otherNode of [...otherParsedFile.prototypeCreations, ...otherParsedFile.prototypeOverwrites]) {
				if (otherNode.getNode()["identifier"] !== goToPrototypeName) continue
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
		const objectNode = node["parent"]
		if (!(objectNode instanceof ObjectNode)) return null

		if ((objectNode.path[0]["value"] !== "this" && objectNode.path[0]["value"] !== "props") || objectNode.path.length === 1) {
			// TODO: handle context properties
			return null
		}

		const { foundIgnoreComment, foundIgnoreBlockComment } = NodeService.getSemanticCommentsNodeIsAffectedBy(objectNode, parsedFile)

		if(foundIgnoreComment) {
			return [{
				uri: parsedFile.uri,
				range: foundIgnoreComment.getPositionAsRange()
			}]
		}

		if(foundIgnoreBlockComment) {
			return [{
				uri: parsedFile.uri,
				range: foundIgnoreBlockComment.getPositionAsRange()
			}]
		}

		const segment = NodeService.findPropertyDefinitionSegment(objectNode, workspace)
		if (segment) {
			if (segment instanceof PathSegment) {
				return [{
					uri: parsedFile.uri,
					range: segment.linePositionedNode.getPositionAsRange()
				}]
			} else {
				return [{
					uri: segment.uri,
					range: segment.statement.path.segments[0].linePositionedNode.getPositionAsRange()
				}]
			}
		}

		return null
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
		const classDefinition: ClassDefinition = foundNodeByLine.getNode()["classDefinition"]
		if (classDefinition === undefined) return null

		return [{
			targetUri: classDefinition.uri,
			targetRange: classDefinition.position,
			targetSelectionRange: classDefinition.position,
			originSelectionRange: foundNodeByLine.getPositionAsRange()
		}]
	}

	getResourceUriPathNodeDefinition(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<ResourceUriNode>) {
		const node = foundNodeByLine.getNode()
		if (!node.canBeFound()) return null
		const uri = workspace.neosWorkspace.getResourceUriPath(node.getNamespace(), node.getRelativePath())
		if (!uri || !NodeFs.existsSync(uri)) return null
		const targetRange = {
			start: { line: 0, character: 0 },
			end: { line: 0, character: 0 },
		}

		return [{
			targetUri: uri,
			targetRange: targetRange,
			targetSelectionRange: targetRange,
			originSelectionRange: foundNodeByLine.getPositionAsRange()
		}]
	}

	getControllerActionDefinition(parsedFile: ParsedFusionFile, workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<ObjectStatement>, context: ParsedFileCapabilityContext<AbstractNode>) {
		const node = foundNodeByLine.getNode()

		if (!(node.operation instanceof ValueAssignment)) return null

		const line = context.params.position.line
		const column = context.params.position.character

		const foundNodes = parsedFile.getNodesByLineAndColumn(line, column)

		const actionUriPartNode = foundNodes.find(positionedNode => (positionedNode.getNode() instanceof ActionUriActionNode || positionedNode.getNode() instanceof ActionUriControllerNode))
		if (actionUriPartNode === undefined) return null

		const actionUriDefinitionNode = <ActionUriDefinitionNode>actionUriPartNode.getNode()["parent"]

		let actionUriDefinition = {
			package: null as string,
			controller: actionUriDefinitionNode.controller?.name.value ?? null as string,
			action: actionUriDefinitionNode.action?.name.value ?? null as string
		}

		for (const statement of actionUriDefinitionNode.statement.block.statementList.statements) {
			if (!(statement instanceof ObjectStatement)) continue
			if (!(statement.operation instanceof ValueAssignment)) continue
			if (!(statement.operation.pathValue instanceof StringValue)) continue
			if (getObjectIdentifier(statement) !== "package") continue

			actionUriDefinition.package = statement.operation.pathValue.value
		}

		if (!actionUriDefinition.package) {
			actionUriDefinition = this.tryToCompleteActionUriDefinitionFromPrototypesInRoutes(node, workspace, actionUriDefinition)
		}

		if (!actionUriDefinition.package) {
			this.log("No package in Action URI definition")
			const neosPackage = workspace.neosWorkspace.getPackageByUri(parsedFile.uri)
			if (!neosPackage) {
				this.log("  Could not resolve Package for current file")
				return null
			}
			actionUriDefinition.package = neosPackage.getPackageName()
		}

		this.logDebug("Found Action URI Definition: ", actionUriDefinition)

		if (!actionUriDefinition.package || !actionUriDefinition.controller || !actionUriDefinition.action) return null

		const neosPackage = workspace.neosWorkspace.getPackage(actionUriDefinition.package)
		if (!neosPackage) {
			this.logDebug(`  Could not resolve defined Package "${actionUriDefinition.package}"`)
			return null
		}

		const definitionTargetName = actionUriPartNode.getNode() instanceof ActionUriControllerNode ? 'controller' : 'action'

		for (const namespace of neosPackage["namespaces"].values()) {
			const className = actionUriDefinition.controller.replace("/", "\\") + 'Controller'
			const fqcnParts = namespace["name"].split("\\").filter(Boolean)
			fqcnParts.push('Controller')
			fqcnParts.push(className)
			const fqcn = fqcnParts.join('\\')

			const classDefinition = namespace.getClassDefinitionFromFullyQualifiedClassName(fqcn)
			if (classDefinition === undefined) {
				this.logDebug(`Could not get class for built FQCN: "${fqcn}"`)
				continue
			}

			if (definitionTargetName === "controller") {
				return [{
					targetUri: classDefinition.uri,
					targetRange: classDefinition.position,
					targetSelectionRange: classDefinition.position,
					originSelectionRange: node.operation.pathValue.linePositionedNode.getPositionAsRange()
				}]
			}

			if (definitionTargetName === "action") {
				const actionName = actionUriDefinition.action + "Action"
				for (const method of classDefinition.methods) {
					if (method.name !== actionName) continue
					return [{
						targetUri: classDefinition.uri,
						targetRange: method.position,
						targetSelectionRange: method.position,
						originSelectionRange: node.operation.pathValue.linePositionedNode.getPositionAsRange()
					}]
				}

				this.logDebug(`Could not find action: "${actionName}"`)
			}
		}
	}

	protected tryToCompleteActionUriDefinitionFromPrototypesInRoutes(node: AbstractNode, workspace: FusionWorkspace, actionUriDefinition: ActionUriDefinition): ActionUriDefinition {
		const foundPrototypeObjectStatement = findUntil<ObjectStatement>(node, (foundNode) => {
			if (!(foundNode instanceof ObjectStatement)) return false
			if (!(foundNode.path.segments[0] instanceof PrototypePathSegment)) return false
			if (!(foundNode.operation instanceof ValueCopy)) return false

			return true
		})

		if (!foundPrototypeObjectStatement) return actionUriDefinition

		const currentPrototypeName = (<PrototypePathSegment>foundPrototypeObjectStatement.path.segments[0]).identifier
		if (!currentPrototypeName) return actionUriDefinition

		for (const otherParsedFile of workspace.parsedFiles) {
			if (!(currentPrototypeName in otherParsedFile.prototypesInRoutes)) continue

			for (const route of otherParsedFile.prototypesInRoutes[currentPrototypeName]) {
				if (route.action !== actionUriDefinition.action) continue

				if (actionUriDefinition.controller) {
					if (route.controller !== actionUriDefinition.controller) continue
					actionUriDefinition.package = route.package
					return actionUriDefinition
				}

				actionUriDefinition.controller = route.controller
				actionUriDefinition.package = route.package
				return actionUriDefinition
			}
		}

		this.logVerbose("could not find in routes")
		return actionUriDefinition
	}

	getTagAttributeDefinition(parsedFile: ParsedFusionFile, workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<TagAttributeNode>, context: ParsedFileCapabilityContext<TagAttributeNode>): null | LocationLink[] {
		const node = foundNodeByLine.getNode()
		const tagNode = findParent(node, TagNode)
		const locationLinks: LocationLink[] = []
		const originSelectionRange = foundNodeByLine.getPositionAsRange()

		const properties = NodeService.getInheritedPropertiesByPrototypeName(tagNode["name"], workspace, true)
		for (const property of properties) {
			if (getObjectIdentifier(property.statement) !== node.name) continue
			locationLinks.push({
				targetUri: property.uri,
				targetRange: property.statement.linePositionedNode.getPositionAsRange(),
				targetSelectionRange: property.statement.linePositionedNode.getPositionAsRange(),
				originSelectionRange
			})
		}

		return locationLinks
	}
}