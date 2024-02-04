import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode';
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement';
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment';
import { Definition, DefinitionParams, LocationLink } from 'vscode-languageserver';
import { ActionUriPartTypes, ActionUriService } from '../common/ActionUriService';
import { LinePositionedNode } from '../common/LinePositionedNode';
import { ActionUriActionNode } from '../fusion/node/ActionUriActionNode';
import { ActionUriControllerNode } from '../fusion/node/ActionUriControllerNode';
import { ElementTextDocumentContext } from './ElementContext';
import { ElementFunctionalityInterface, ElementInterface } from './ElementInterface';

export interface ActionUriDefinition {
	package: string
	controller: string
	action: string
}

export class ControllerActionElement implements ElementInterface<ObjectStatement> {
	isResponsible(methodName: keyof ElementFunctionalityInterface<AbstractNode>, node: AbstractNode | undefined): boolean {
		return node instanceof ObjectStatement
	}

	async onDefinition(context: ElementTextDocumentContext<DefinitionParams, ObjectStatement>): Promise<LocationLink[] | Definition | null | undefined> {
		// TODO: Account for multiple action definitions as resolving cannot be a 100% certain
		const node = context.foundNodeByLine!.getNode()
		if (!(node.operation instanceof ValueAssignment)) return null

		const foundNodes = context.parsedFile!.getNodesByPosition(context.params.position)
		if (!foundNodes) return null

		const actionUriPartNode = <LinePositionedNode<ActionUriActionNode | ActionUriControllerNode>>foundNodes.find(positionedNode => (positionedNode.getNode() instanceof ActionUriActionNode || positionedNode.getNode() instanceof ActionUriControllerNode))
		if (actionUriPartNode === undefined) return null

		const actionUriDefinitionNode = actionUriPartNode.getNode().parent
		const definitionTargetName = actionUriPartNode.getNode() instanceof ActionUriControllerNode ? ActionUriPartTypes.Controller : ActionUriPartTypes.Action
		return ActionUriService.resolveActionUriDefinitionNode(node, actionUriDefinitionNode, definitionTargetName, context.workspace, context.parsedFile!)
	}
}