import { AbstractNode } from 'ts-fusion-parser/out/core/objectTreeParser/ast/AbstractNode';
import { NodePosition } from 'ts-fusion-parser/out/core/objectTreeParser/ast/NodePosition';
import { AstNodeVisitorInterface } from 'ts-fusion-parser/out/core/objectTreeParser/astNodeVisitorInterface';
import { EelHelperNode } from './EelHelperNode';

export class EelHelperMethodNode extends AbstractNode {
	public identifier: string
	public eelHelper: EelHelperNode

	constructor(identifier: string, position: NodePosition) {
		super()
		this.identifier = identifier
		this.position = position
	}
	

	visit(visitor: AstNodeVisitorInterface, ...args: any[]) {
		// stub
	}


}