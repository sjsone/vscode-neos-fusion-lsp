import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'

export class RoutingControllerNode extends AbstractNode {
	statement: ObjectStatement
	name: string

	constructor(statement: ObjectStatement, name: string) {
		let begin: number | undefined = undefined
		let end = 0
		for (const segment of statement.path.segments) {
			if (begin === undefined) begin = segment.position.begin
			end = segment.position.end
		}

		super({ begin: begin!, end })
		this.statement = statement
		this.name = name
	}
}