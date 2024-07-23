import { DefinitionParams, Definition, LocationLink, Location } from 'vscode-languageserver'
import { ElementTextDocumentContext } from './ElementContext'
import { ElementInterface } from './ElementInterface'
// import { ParsedFileCapabilityContext } from '../capabilities/CapabilityContext'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { RoutingActionNode } from '../fusion/node/RoutingActionNode'
import { RoutingControllerNode } from '../fusion/node/RoutingControllerNode'
import { Logger } from '../common/Logging'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'

export class RoutingElement extends Logger implements ElementInterface<RoutingControllerNode | RoutingActionNode> {
	isResponsible(methodName: keyof ElementInterface<AbstractNode>, node: AbstractNode | undefined): boolean {
		return node instanceof RoutingControllerNode || node instanceof RoutingActionNode
	}

	async onDefinition(context: ElementTextDocumentContext<DefinitionParams, RoutingControllerNode | RoutingActionNode>): Promise<LocationLink[] | Definition | null | undefined> {
		if (!context.foundNodeByLine) return null

		const foundNodeByLine = context.foundNodeByLine
		const node = foundNodeByLine.getNode()

		if (node instanceof RoutingControllerNode) return this.getRoutingControllerNode(context.parsedFile, context.workspace, foundNodeByLine, context)
		if (node instanceof RoutingActionNode) return this.getRoutingActionNode(context.parsedFile, context.workspace, <LinePositionedNode<RoutingActionNode>>foundNodeByLine)

		return null
	}

	getRoutingControllerNode(parsedFile: ParsedFusionFile, workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<RoutingControllerNode>, context: ElementTextDocumentContext<DefinitionParams, RoutingControllerNode | RoutingActionNode>): null | LocationLink[] {
		const node = foundNodeByLine.getNode()

		const classDefinition = RoutingControllerNode.getClassDefinitionFromRoutingControllerNode(parsedFile, workspace, node)
		if (!classDefinition) return null

		return [{
			targetUri: classDefinition.uri,
			originSelectionRange: node.linePositionedNode.getPositionAsRange(),
			targetRange: classDefinition.position,
			targetSelectionRange: classDefinition.position
		}]
	}

	getRoutingActionNode(parsedFile: ParsedFusionFile, workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<RoutingActionNode>): null | Location {
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