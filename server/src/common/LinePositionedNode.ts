import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { Range } from 'vscode-languageserver'
import { getLineNumberOfChar } from './util'

export interface LinePosition {
	line: number
	character: number
}

declare module 'ts-fusion-parser/out/common/AbstractNode' {
    interface AbstractNode { linePositionedNode: LinePositionedNode<typeof this>; }
}

export class LinePositionedNode<T extends AbstractNode> {
	protected node: T

	protected start: LinePosition
	protected end: LinePosition

	constructor(node: T, text: string = undefined) {
		this.node = node
		this.node.linePositionedNode = this

		if (node["position"] !== undefined && text !== undefined) {
			const begin = node["position"].begin ?? (node["position"]).begin
			this.start = getLineNumberOfChar(text, begin)
			this.end = getLineNumberOfChar(text, node["position"].end)
		}
	}

	getNode() {
		return this.node
	}

	setBegin(begin: LinePosition) {
		this.start = begin
	}

	setEnd(end: LinePosition) {
		this.end = end
	}

	getBegin() {
		return this.start
	}

	getEnd() {
		return this.end
	}

	getPositionAsRange(): Range {
		return {
			start: this.getBegin(),
			end: this.getEnd(),
		}
	}
}