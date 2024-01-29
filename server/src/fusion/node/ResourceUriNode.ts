import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { NodePosition } from 'ts-fusion-parser/out/common/NodePosition'

export class ResourceUriNode extends AbstractNode {
	public identifier: string
	protected namespace!: string
	protected relativePath!: string

	constructor(identifier: string, position: NodePosition) {
		super(position)
		this.identifier = identifier

		const matches = /resource:\/\/(.*?)(\/.*)/.exec(this.identifier)
		if (matches !== null) {
			this.namespace = matches[1]
			this.relativePath = matches[2]
		}
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

}