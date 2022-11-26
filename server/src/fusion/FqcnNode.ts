import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { NodePosition } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/NodePosition'
import { AstNodeVisitorInterface } from 'ts-fusion-parser/out/fusion/objectTreeParser/astNodeVisitorInterface'
import { ClassDefinition } from '../neos/NeosPackageNamespace'

export class FqcnNode extends AbstractNode {
	protected identifier: string
	protected classDefinition: ClassDefinition

	constructor(identifier: string, classDefinition: ClassDefinition, position: NodePosition) {
		super()
		this.identifier = identifier
		this.classDefinition = classDefinition
		this.position = position
	}

	visit(visitor: AstNodeVisitorInterface, ...args: any[]) {
		// stub
	}
}