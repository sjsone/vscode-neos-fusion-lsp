import * as NodeFs from 'fs'
import * as NodePath from 'path'

import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue'
import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment'
import { DefinitionLink, Location } from 'vscode-languageserver/node'
import { PhpClassMethodNode } from '../fusion/PhpClassMethodNode'
import { PhpClassNode } from '../fusion/PhpClassNode'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { LinePositionedNode } from '../LinePositionedNode'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { findParent, getObjectIdentifier, getPrototypeNameFromNode } from '../util'
import { AbstractCapability } from './AbstractCapability'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { NodeService } from '../NodeService'
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { FqcnNode } from '../fusion/FqcnNode'
import { ClassDefinition } from '../neos/NeosPackageNamespace'
import { ResourceUriNode } from '../fusion/ResourceUriNode'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ObjectStatement'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueAssignment'
import { StringValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/StringValue'

export class DefinitionCapability extends AbstractCapability {

	protected run(context: CapabilityContext<AbstractNode>) {
		const { workspace, parsedFile, foundNodeByLine } = <ParsedFileCapabilityContext<AbstractNode>>context
		const node = foundNodeByLine.getNode()

		this.log(`node type "${foundNodeByLine.getNode().constructor.name}"`)
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
				return this.getControllerActionDefinition(parsedFile, workspace, <LinePositionedNode<ObjectStatement>>foundNodeByLine)
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

	getControllerActionDefinition(parsedFile: ParsedFusionFile, workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<ObjectStatement>) {
		const node = foundNodeByLine.getNode()
		if (!(node.operation instanceof ValueAssignment)) return null

		const parentStatement = findParent(node, ObjectStatement)
		if (!(parentStatement.operation instanceof ValueAssignment)) return null
		if (!(parentStatement.operation.pathValue instanceof FusionObjectValue)) return null

		if (!["Neos.Fusion:ActionUri", "Neos.Fusion:UriBuilder"].includes(parentStatement.operation.pathValue.value)) return null

		const definitionTargetName = getObjectIdentifier(node)
		if (definitionTargetName !== "controller" && definitionTargetName !== "action") return null

		const actionUriDefinition = {
			package: null as string,
			controller: null as string,
			action: null as string
		}

		for (const statement of parentStatement.block.statementList.statements) {
			if (!(statement instanceof ObjectStatement)) continue
			if (!(statement.operation instanceof ValueAssignment)) continue
			if (!(statement.operation.pathValue instanceof StringValue)) continue

			const identifier = getObjectIdentifier(statement)
			if (identifier in actionUriDefinition) {
				actionUriDefinition[identifier] = statement.operation.pathValue.value
			}
		}

		if (!actionUriDefinition.package) {
			this.logDebug("No package in Action URI definition")
			const neosPackage = workspace.neosWorkspace.getPackageByUri(parsedFile.uri)
			if (!neosPackage) {
				this.logDebug("  Could not resolve Package for current file")
				return null
			}
			actionUriDefinition.package = neosPackage.getPackageName()
		}

		this.logVerbose("Found Action URI Definition: ", actionUriDefinition)

		if (!actionUriDefinition.package || !actionUriDefinition.controller || !actionUriDefinition.action) return null

		const neosPackage = workspace.neosWorkspace.getPackage(actionUriDefinition.package)
		if (!neosPackage) {
			this.logDebug(`  Could not resolve defined Package "${actionUriDefinition.package}"`)
			return null
		}

		for (const namespace of neosPackage["namespaces"].values()) {
			const className = actionUriDefinition.controller + 'Controller'
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
}