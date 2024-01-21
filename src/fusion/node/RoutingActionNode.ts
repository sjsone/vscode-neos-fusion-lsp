import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { RoutingControllerNode } from './RoutingControllerNode'

export class RoutingActionNode extends AbstractNode {
	statement: ObjectStatement
	name: string
	parent: RoutingControllerNode

	constructor(parent: RoutingControllerNode, statement: ObjectStatement, name: string) {
		let begin: number | undefined = undefined
		let end = 0
		for (const segment of statement.path.segments) {
			if (begin === undefined) begin = segment.position.begin
			end = segment.position.end
		}

		super({ begin: begin!, end })
		this.parent = parent
		this.statement = statement
		this.name = name
	}
}