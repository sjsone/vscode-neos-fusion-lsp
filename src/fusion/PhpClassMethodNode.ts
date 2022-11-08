import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/eel/nodes/ObjectFunctionPathNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/eel/nodes/ObjectPathNode'
import { AbstractNode } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/AbstractNode'
import { NodePosition } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/NodePosition'
import { AstNodeVisitorInterface } from 'ts-fusion-parser/out/fusion/objectTreeParser/astNodeVisitorInterface'
import { PhpClassNode } from './PhpClassNode'

export class PhpClassMethodNode extends AbstractNode {
	public identifier: string
	public eelHelper: PhpClassNode
	public pathNode: ObjectFunctionPathNode | ObjectPathNode

	constructor(identifier: string, pathNode: ObjectFunctionPathNode | ObjectPathNode, position: NodePosition) {
		super()
		this.identifier = identifier
		this.pathNode = pathNode
		this.position = position
	}


	visit(visitor: AstNodeVisitorInterface, ...args: any[]) {
		// stub
	}
}