import { AbstractNode } from 'ts-fusion-parser/out/core/objectTreeParser/ast/AbstractNode';
import { LinePositionedNode } from './LinePositionedNode';

export class DefinitionItem<T extends AbstractNode> {
	protected node: LinePositionedNode<T>

	protected sources: LinePositionedNode<any>[] = []

	constructor(node: LinePositionedNode<T>) {
		this.node = node
	}

	addSource(source: LinePositionedNode<any>) {
		if (!this.sources.includes(source)) {
			this.sources.push(source)
		}
	}

	getSources() {
		return this.sources
	}
}