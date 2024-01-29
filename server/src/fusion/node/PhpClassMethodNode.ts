import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { NodePosition } from 'ts-fusion-parser/out/common/NodePosition'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { PhpClassNode } from './PhpClassNode'

export class PhpClassMethodNode extends AbstractNode {
	public identifier: string
	public eelHelper!: PhpClassNode
	public pathNode: ObjectFunctionPathNode | ObjectPathNode

	constructor(identifier: string, pathNode: ObjectFunctionPathNode | ObjectPathNode, position: NodePosition) {
		super(position)
		this.identifier = identifier
		this.pathNode = pathNode
	}
}