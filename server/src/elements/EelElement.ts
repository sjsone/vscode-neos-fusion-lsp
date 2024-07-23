import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { HoverParams, Hover } from 'vscode-languageserver'
import { ElementTextDocumentContext } from './ElementContext'
import { ElementFunctionalityInterface, ElementInterface } from './ElementInterface'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { findParent, abstractNodeToString } from '../common/util'
import { ElementHelper } from './ElementHelper'
import { NodeService } from '../common/NodeService'

export class EelElement implements ElementInterface<ObjectPathNode> {

	isResponsible(methodName: keyof ElementFunctionalityInterface<AbstractNode>, node: AbstractNode | undefined): boolean {
		return node instanceof ObjectPathNode
	}

	async onHover(context: ElementTextDocumentContext<HoverParams, ObjectPathNode>): Promise<Hover | null | undefined> {
		if (!context.foundNodeByLine) return null

		const node = context.foundNodeByLine.getNode()
		const objectNode = node.parent
		if (!(objectNode instanceof ObjectNode)) return null

		// TODO: check if this conditions are still necessary 
		if ((objectNode.path[0].value !== "this" && objectNode.path[0].value !== "props") || objectNode.path.length < 2) return null


		const externalObjectStatement = NodeService.findPropertyDefinitionSegment(objectNode, context.workspace, true)

		const segment = <PathSegment>externalObjectStatement?.statement.path.segments[0]
		if (segment && segment instanceof PathSegment) {
			const statement = findParent(segment, ObjectStatement)
			if (!statement) return null
			if (!(statement.operation instanceof ValueAssignment)) return null

			const stringified = abstractNodeToString(statement.operation.pathValue)
			const name = node.value

			// TODO: fix that sometimes "stringified === '${undefined}"
			if (stringified !== undefined) return ElementHelper.createHover(
				[
					`EEL **${name}**`,
					'```fusion',
					`${name} = ${stringified}`,
					'```'
				].join('\n'),
				context.foundNodeByLine
			)
		}

		return ElementHelper.createHover(`EEL **${node.value}**`, context.foundNodeByLine)
	}
}