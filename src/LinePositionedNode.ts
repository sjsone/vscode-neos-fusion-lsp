import { AbstractNode } from 'ts-fusion-parser/out/core/objectTreeParser/ast/AbstractNode';
import { getLineNumberOfChar } from './util';

export interface LinePosition {
	line: number
	column: number
}

export class LinePositionedNode<T extends AbstractNode> {
	protected node: T

	protected begin: LinePosition
	protected end: LinePosition

	constructor(node: T, text: string = undefined) {
		this.node = node

		if(node["position"] !== undefined && text !== undefined) {
			this.begin = getLineNumberOfChar(text, node["position"].start)
			this.end = getLineNumberOfChar(text, node["position"].end)
		}
	}

	getNode() {
		return this.node
	}
	
	setBegin(begin: LinePosition) {
		this.begin = begin
	}

	setEnd(end: LinePosition) {
		this.end = end
	}

	getBegin() {
		return this.begin
	}

	getEnd() {
		return this.end
	}
}