import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode';
import { LiteralStringNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode';

export class TranslationShortHandNode extends AbstractNode {
	constructor(
		public literalStringNode: LiteralStringNode
	) {
		super(literalStringNode["position"], literalStringNode["parent"])
	}

	getValue() {
		return this.literalStringNode["value"]
	}
}