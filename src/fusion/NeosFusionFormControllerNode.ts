import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode';
import { NeosFusionFormDefinitionNode } from './NeosFusionFormDefinitionNode';
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode';

export class NeosFusionFormControllerNode extends AbstractNode {
	tagAttribute: TagAttributeNode
	parent: NeosFusionFormDefinitionNode

	constructor(tagAttribute: TagAttributeNode) {
		super(tagAttribute["position"])
		this.tagAttribute = tagAttribute
	}
}