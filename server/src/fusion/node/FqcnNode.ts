import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { NodePosition, NodePositionStub } from 'ts-fusion-parser/out/common/NodePosition'
import { ClassDefinition } from '../../neos/NeosPackageNamespace'

export class FqcnNode extends AbstractNode {
	protected identifier: string
	protected classDefinition: ClassDefinition

	constructor(identifier: string, classDefinition: ClassDefinition, position: NodePosition) {
		super(NodePositionStub)
		this.identifier = identifier
		this.classDefinition = classDefinition
		this.position = position
	}
}