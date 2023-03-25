import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { NodePosition } from 'ts-fusion-parser/out/common/NodePosition'
import { PhpClassMethodNode } from './PhpClassMethodNode'

export class PhpClassNode extends AbstractNode {
	public identifier: string
	public method: PhpClassMethodNode | null
	public objectNode: ObjectNode

	constructor(identifier: string, method: PhpClassMethodNode | null, objectNode: ObjectNode, position: NodePosition) {
		super(position)
		this.identifier = identifier
		this.method = method
		this.objectNode = objectNode

		if (this.method) this.method.eelHelper = this
	}

}