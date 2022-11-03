import { AbstractNode } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/AbstractNode'
import { NodePosition } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/NodePosition'
import { AstNodeVisitorInterface } from 'ts-fusion-parser/out/fusion/objectTreeParser/astNodeVisitorInterface'
import { PhpClassMethodNode } from './PhpClassMethodNode'

export class PhpClassNode extends AbstractNode {
	public identifier: string
	public method: PhpClassMethodNode|null

	constructor(identifier: string, method: PhpClassMethodNode|null, position: NodePosition) {
		super()
		this.identifier = identifier
		this.method = method
		this.position = position

		if(this.method) this.method.eelHelper = this
	}


	visit(visitor: AstNodeVisitorInterface, ...args: any[]) {
		// stub
	}


}