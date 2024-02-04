import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { NodePositionInterface } from "ts-fusion-parser/out/common/NodePositionInterface"
import { FlowConfigurationPathNode } from './FlowConfigurationPathNode'

export class FlowConfigurationPathPartNode extends AbstractNode {
	protected value: string
	public parent!: FlowConfigurationPathNode

	constructor(value: string, position: NodePositionInterface, parent?: AbstractNode | undefined) {
		super(position, parent)
		this.value = value
	}
}