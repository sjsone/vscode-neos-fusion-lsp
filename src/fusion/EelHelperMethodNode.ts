import { AbstractNode } from 'ts-fusion-parser/out/core/objectTreeParser/ast/AbstractNode';
import { NodePosition } from 'ts-fusion-parser/out/core/objectTreeParser/ast/NodePosition';
import { AstNodeVisitorInterface } from 'ts-fusion-parser/out/core/objectTreeParser/astNodeVisitorInterface';

export class EelHelperMethodNode extends AbstractNode {
	public identifier: string
	public method: string|null

	constructor(identifier: string, method: string|null, position: NodePosition) {
		super()
		this.identifier = identifier
		this.method = method
		this.position = position
	}


	visit(visitor: AstNodeVisitorInterface, ...args: any[]) {
		// stub
	}


}