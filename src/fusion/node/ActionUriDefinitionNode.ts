import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { ActionUriActionNode } from './ActionUriActionNode'
import { ActionUriControllerNode } from './ActionUriControllerNode'

export class ActionUriDefinitionNode extends AbstractNode {
	statement: ObjectStatement
	action?: ActionUriActionNode
	controller?: ActionUriControllerNode

	constructor(statement: ObjectStatement) {
		super(statement.position)
		this.statement = statement
	}

	setAction(action: ActionUriActionNode) {
		this.action = action
		this.action.parent = this
	}

	setController(controller: ActionUriControllerNode) {
		this.controller = controller
		this.controller.parent = this
	}
}