import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { NeosFusionFormActionNode } from './NeosFusionFormActionNode'
import { NeosFusionFormControllerNode } from './NeosFusionFormControllerNode'

export class NeosFusionFormDefinitionNode extends AbstractNode {
	tag: TagNode
	action?: NeosFusionFormActionNode
	controller?: NeosFusionFormControllerNode

	constructor(tag: TagNode) {
		super(tag.position)
		this.tag = tag
	}

	setAction(action: NeosFusionFormActionNode) {
		this.action = action
		this.action.parent = this
	}

	setController(controller: NeosFusionFormControllerNode) {
		this.controller = controller
		this.controller.parent = this
	}
}