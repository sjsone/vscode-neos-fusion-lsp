import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { NodePosition } from 'ts-fusion-parser/out/common/NodePosition'
import { ClassDefinition } from '../../neos/NeosPackageNamespace'

export class FqcnNode extends AbstractNode {
	readonly realLength: number

	constructor(public identifier: string, public classDefinition: ClassDefinition, position: NodePosition) {
		super(position)

		this.realLength = identifier.length + identifier.split('\\').length - 1
	}
}