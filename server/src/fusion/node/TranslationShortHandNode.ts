import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { LiteralStringNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode'
import { ShortHandIdentifier, XLIFFService } from '../../common/XLIFFService'

declare module 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode' {
	interface LiteralStringNode {
		translationShortHandNode?: TranslationShortHandNode
	}
}

export class TranslationShortHandNode extends AbstractNode {
	public shortHandIdentifier?: ShortHandIdentifier

	constructor(
		public literalStringNode: LiteralStringNode
	) {
		super(literalStringNode.position, literalStringNode.parent)
		literalStringNode.translationShortHandNode = this
	}

	getShortHandIdentifier() {
		if (!this.shortHandIdentifier) this.shortHandIdentifier = XLIFFService.readShortHandIdentifier(this.getValue())
		return this.shortHandIdentifier
	}

	getValue() {
		return this.literalStringNode.value
	}
}