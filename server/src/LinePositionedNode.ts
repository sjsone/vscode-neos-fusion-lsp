import { ObjectNode } from 'ts-fusion-parser/out/eel/nodes/ObjectNode'
import { AbstractNode } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/AbstractNode'
import { Range } from 'vscode-languageserver'
import { getLineNumberOfChar } from './util'

export interface LinePosition {
	line: number
	character: number
}

export class LinePositionedNode<T extends AbstractNode> {
	protected node: T

	protected start: LinePosition
	protected end: LinePosition

	constructor(node: T, text: string = undefined) {
		this.node = node
		// TODO: Make linePositionedNode typesafe 
		this.node["linePositionedNode"] = this

		if (node["position"] !== undefined && text !== undefined) {
			const begin = node["position"].start ?? (<any>node["position"]).begin
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

	static Get<T extends AbstractNode>(node: T): undefined | LinePositionedNode<T> {
		return node["linePositionedNode"]
	}
}