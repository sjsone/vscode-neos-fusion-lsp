import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode';
import { LiteralStringNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode';

declare module 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode' {
	interface LiteralStringNode {
		translationShortHandNode?: TranslationShortHandNode
	}
}

export class TranslationShortHandNode extends AbstractNode {
	constructor(
		public literalStringNode: LiteralStringNode
	) {
		super(literalStringNode["position"], literalStringNode["parent"])
		literalStringNode["translationShortHandNode"] = this
	}

	getValue() {
		return this.literalStringNode["value"]
	}
}