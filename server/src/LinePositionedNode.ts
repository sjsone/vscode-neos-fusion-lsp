import { ObjectNode } from 'ts-fusion-parser/out/eel/nodes/ObjectNode'
import { AbstractNode } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/AbstractNode'
import { Range } from 'vscode-languageserver'
import { getLineNumberOfChar } from './util'

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
		// TODO: Make linePositionedNode typesafe 
		this.node["linePositionedNode"] = this

		if (node["position"] !== undefined && text !== undefined) {
			const begin = node["position"].start ?? (<any>node["position"]).begin
			this.begin = getLineNumberOfChar(text, begin)
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

	getPositionAsRange(): Range {
		return {
			start: { line: this.getBegin().line - 1, character: this.getBegin().column - 1 },
			end: { line: this.getEnd().line - 1, character: this.getEnd().column - 1 },
		}
	}

	static Get<T extends AbstractNode>(node: T): undefined | LinePositionedNode<T> {
		return node["linePositionedNode"]
	}
}