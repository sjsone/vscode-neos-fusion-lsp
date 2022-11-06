import { AbstractNode } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/AbstractNode'
import { NodePosition } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/NodePosition'
import { AstNodeVisitorInterface } from 'ts-fusion-parser/out/fusion/objectTreeParser/astNodeVisitorInterface'

export class ResourceUriNode extends AbstractNode {
	protected identifier: string
	protected namespace: string
	protected relativePath: string

	constructor(identifier: string, position: NodePosition) {
		super()
		this.identifier = identifier

		const matches = /resource:\/\/(.*?)(\/.*)/.exec(this.identifier)

		if (matches !== null) {
			this.namespace = matches[1]
			this.relativePath = matches[2]
		}


		this.position = position
	}

	canBeFound() {
		return this.namespace !== null && this.relativePath !== null
	}

	getNamespace() {
		return this.namespace
	}

	getRelativePath() {
		return this.relativePath
	}

	visit(visitor: AstNodeVisitorInterface, ...args: any[]) {
		// stub
	}
}