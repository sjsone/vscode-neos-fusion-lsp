import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { StringValue } from 'ts-fusion-parser/out/fusion/nodes/StringValue'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { ValueCopy } from 'ts-fusion-parser/out/fusion/nodes/ValueCopy'
import { Range } from 'vscode-languageserver'
import { ActionUriDefinition } from '../capabilities/DefinitionCapability'
import { ActionUriDefinitionNode } from '../fusion/node/ActionUriDefinitionNode'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { NeosFusionFormDefinitionNode } from '../fusion/node/NeosFusionFormDefinitionNode'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { NeosPackageNamespace } from '../neos/NeosPackageNamespace'
import { Logger } from './Logging'
import { NodeService } from './NodeService'
import { findUntil, getObjectIdentifier } from './util'

export enum ActionUriPartTypes {
	Package = 'package',
	Action = 'action',
	Controller = 'controller'
}

//TODO: Maybe there is a better name than `ActionUri` for Action/Controller/Package combination 
class ActionUriService extends Logger {

	public hasPrototypeNameActionUri(prototypeName: string, workspace: FusionWorkspace) {
		const actionUriBasePrototypes = ["Neos.Fusion:ActionUri", "Neos.Fusion:UriBuilder", "Neos.Neos:Plugin"]
		for (const actionUriBasePrototype of actionUriBasePrototypes) {
			if (NodeService.isPrototypeOneOf(prototypeName, actionUriBasePrototype, workspace)) return true
		}

		return false
	}

	public resolveFusionFormDefinitionNode(tagAttributeNode: TagAttributeNode, neosFusionFormDefinitionNode: NeosFusionFormDefinitionNode, definitionTargetName: ActionUriPartTypes, workspace: FusionWorkspace, parsedFile: ParsedFusionFile) {
		const actionUriDefinition = this.buildBaseActionUriDefinitionFromFusionFormDefinitionNode(neosFusionFormDefinitionNode)
		// TODO: implement tryToCompleteActionUriDefinitionPackage for `NeosFusionFormDefinitionNode`
		// actionUriDefinition = this.tryToCompleteActionUriDefinitionPackage(tagAttributeNode, workspace, parsedFile, actionUriDefinition)
		this.logDebug("Found Action URI Definition: ", actionUriDefinition)

		if (!actionUriDefinition.package || !actionUriDefinition.controller || !actionUriDefinition.action) return null

		const neosPackage = workspace.neosWorkspace.getPackage(actionUriDefinition.package)
		if (!neosPackage) {
			this.logInfo(`  Could not resolve defined Package "${actionUriDefinition.package}"`)
			return null
		}

		const className = actionUriDefinition.controller.replace("/", "\\") + 'Controller'

		for (const namespace of neosPackage.namespaces.values()) {
			const range = tagAttributeNode.linePositionedNode.getPositionAsRange()
			const definition = this.searchInNamespaceForControllerActionDefinition(range, definitionTargetName, namespace, className, actionUriDefinition.action)
			if (definition) return definition
		}

		return null
	}

	public resolveActionUriDefinitionNode(objectStatement: ObjectStatement, actionUriDefinitionNode: ActionUriDefinitionNode, definitionTargetName: ActionUriPartTypes, workspace: FusionWorkspace, parsedFile: ParsedFusionFile) {
		let actionUriDefinition = this.buildBaseActionUriDefinitionFromActionUriDefinitionNode(actionUriDefinitionNode)
		actionUriDefinition = this.tryToCompleteActionUriDefinitionPackage(objectStatement, workspace, parsedFile, actionUriDefinition)

		this.logDebug("Found Action URI Definition: ", actionUriDefinition)

		if (!actionUriDefinition.package || !actionUriDefinition.controller || !actionUriDefinition.action) return null

		const neosPackage = workspace.neosWorkspace.getPackage(actionUriDefinition.package)
		if (!neosPackage) {
			this.logDebug(`  Could not resolve defined Package "${actionUriDefinition.package}"`)
			return null
		}

		const className = actionUriDefinition.controller.replace("/", "\\") + 'Controller'

		for (const namespace of neosPackage.namespaces.values()) {
			const originSelectionRange = (<ValueAssignment>objectStatement.operation).pathValue.linePositionedNode.getPositionAsRange()
			const definition = this.searchInNamespaceForControllerActionDefinition(originSelectionRange, definitionTargetName, namespace, className, actionUriDefinition.action)
			if (definition) return definition
		}

		return null
	}

	protected searchInNamespaceForControllerActionDefinition(originSelectionRange: Range, definitionTargetName: ActionUriPartTypes, namespace: NeosPackageNamespace, className: string, actionName: string) {
		const fqcnParts = namespace.name.split("\\").filter(Boolean)
		fqcnParts.push('Controller')
		fqcnParts.push(className)
		const fqcn = fqcnParts.join('\\')

		const classDefinition = namespace.getClassDefinitionFromFullyQualifiedClassName(fqcn)
		if (classDefinition === undefined) {
			this.logDebug(`Could not get class for built FQCN: "${fqcn}"`)
			return undefined
		}

		if (definitionTargetName === "controller") return [{
			targetUri: classDefinition.uri,
			targetRange: classDefinition.position,
			targetSelectionRange: classDefinition.position,
			originSelectionRange
		}]

		if (definitionTargetName === "action") {
			const fullActionName = actionName + "Action"
			for (const method of classDefinition.methods) {
				if (method.name !== fullActionName) continue
				return [{
					targetUri: classDefinition.uri,
					targetRange: method.position,
					targetSelectionRange: method.position,
					originSelectionRange
				}]
			}

			this.logDebug(`Could not find action: "${fullActionName}"`)
		}

		return undefined
	}

	protected buildBaseActionUriDefinitionFromActionUriDefinitionNode(actionUriDefinitionNode: ActionUriDefinitionNode) {
		const actionUriDefinition = {
			package: <string><unknown>null,
			controller: actionUriDefinitionNode.controller?.name?.value ?? <string><unknown>null,
			action: actionUriDefinitionNode.action?.name?.value ?? <string><unknown>null
		}

		for (const statement of actionUriDefinitionNode.statement.block!.statementList.statements) {
			if (!(statement instanceof ObjectStatement)) continue
			if (!(statement.operation instanceof ValueAssignment)) continue
			if (!(statement.operation.pathValue instanceof StringValue)) continue
			if (getObjectIdentifier(statement) !== "package") continue

			actionUriDefinition.package = statement.operation.pathValue.value
		}

		return actionUriDefinition
	}

	protected buildBaseActionUriDefinitionFromFusionFormDefinitionNode(neosFusionFormDefinitionNode: NeosFusionFormDefinitionNode) {
		const actionUriDefinition = {
			package: <string><unknown>null,
			controller: neosFusionFormDefinitionNode.controller?.tagAttribute ? this.getTagAttributeValue(neosFusionFormDefinitionNode.controller?.tagAttribute) : <string><unknown>null,
			action: neosFusionFormDefinitionNode.action?.tagAttribute ? this.getTagAttributeValue(neosFusionFormDefinitionNode.action?.tagAttribute) : <string><unknown>null
		}

		for (const attribute of neosFusionFormDefinitionNode.tag.attributes) {
			if (!(attribute instanceof TagAttributeNode)) continue
			if (typeof attribute.value !== "string") continue
			if (attribute.name !== "form.target.package") continue

			actionUriDefinition.package = <string><unknown>this.getTagAttributeValue(attribute)
		}

		return actionUriDefinition
	}

	protected tryToCompleteActionUriDefinitionPackage(node: AbstractNode, workspace: FusionWorkspace, parsedFile: ParsedFusionFile, actionUriDefinition: ActionUriDefinition) {
		if (!actionUriDefinition.package) {
			actionUriDefinition = this.tryToCompleteActionUriDefinitionWithWorkspace(node, workspace, actionUriDefinition)
		}

		if (!actionUriDefinition.package) {
			this.log("No package in Action URI definition")
			const neosPackage = workspace.neosWorkspace.getPackageByUri(parsedFile.uri)
			if (!neosPackage) {
				this.log("  Could not resolve Package for current file")
				return actionUriDefinition
			}
			actionUriDefinition.package = neosPackage.getPackageName()
		}
		return actionUriDefinition
	}

	protected tryToCompleteActionUriDefinitionWithWorkspace(node: AbstractNode, workspace: FusionWorkspace, actionUriDefinition: ActionUriDefinition): ActionUriDefinition {
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
			const completedActionUriDefinition = this.tryToCompleteActionUriDefinitionWithParsedFile(currentPrototypeName, otherParsedFile, actionUriDefinition)
			if (completedActionUriDefinition) return completedActionUriDefinition
		}

		this.logVerbose("could not find in routes")
		return actionUriDefinition
	}

	protected tryToCompleteActionUriDefinitionWithParsedFile(currentPrototypeName: string, parsedFile: ParsedFusionFile, actionUriDefinition: ActionUriDefinition) {
		for (const routeDefinition of parsedFile.getRouteDefinitionsForPrototypeName(currentPrototypeName)) {
			if (actionUriDefinition.controller) {
				if (routeDefinition.controllerName !== actionUriDefinition.controller) continue
				actionUriDefinition.package = routeDefinition.packageName
				return actionUriDefinition
			}

			actionUriDefinition.controller = routeDefinition.controllerName
			actionUriDefinition.package = routeDefinition.packageName
			return actionUriDefinition
		}

		return undefined
	}

	protected getTagAttributeValue(tagAttribute: TagAttributeNode) {
		if (typeof tagAttribute.value !== "string") return undefined
		return tagAttribute.value.substring(1, tagAttribute.value.length - 1)
	}
}

const actionUriServiceInstance = new ActionUriService

export {
	actionUriServiceInstance as ActionUriService
}
