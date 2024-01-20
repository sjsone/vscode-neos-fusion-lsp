import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { NeosFusionFormDefinitionNode } from './NeosFusionFormDefinitionNode'

export class NeosFusionFormActionNode extends AbstractNode {
	tagAttribute: TagAttributeNode
	parent!: NeosFusionFormDefinitionNode

	constructor(tagAttribute: TagAttributeNode) {
		super(tagAttribute.position)
		this.tagAttribute = tagAttribute
	}
}