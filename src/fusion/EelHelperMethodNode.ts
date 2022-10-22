import { AbstractNode } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/AbstractNode';
import { NodePosition } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/NodePosition';
import { AstNodeVisitorInterface } from 'ts-fusion-parser/out/fusion/objectTreeParser/astNodeVisitorInterface';
import { EelHelperNode } from './EelHelperNode';

export class EelHelperMethodNode extends AbstractNode {
	public identifier: string;
	public eelHelper: EelHelperNode;

	constructor(identifier: string, position: NodePosition) {
		super();
		this.identifier = identifier;
		this.position = position;
	}
	

	visit(visitor: AstNodeVisitorInterface, ...args: any[]) {
		// stub
	}


}