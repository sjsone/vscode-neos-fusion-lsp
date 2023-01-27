import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode';
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ObjectStatement';
import { StringValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/StringValue';

export class ActionUriControllerNode extends AbstractNode {
	statement: ObjectStatement
	name: StringValue

	constructor(statement: ObjectStatement, name: StringValue) {
		super(statement["position"], undefined)
		this.statement = statement
		this.name = name
	}
}