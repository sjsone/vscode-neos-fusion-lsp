import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { StringValue } from 'ts-fusion-parser/out/fusion/nodes/StringValue'
import { ActionUriDefinitionNode } from './ActionUriDefinitionNode'

export class ActionUriControllerNode extends AbstractNode {
	statement: ObjectStatement
	name: StringValue
	parent!: ActionUriDefinitionNode

	constructor(statement: ObjectStatement, name: StringValue) {
		super(statement.position)
		this.statement = statement
		this.name = name
	}
}