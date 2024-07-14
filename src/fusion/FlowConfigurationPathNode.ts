import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { NodePositionInterface } from "ts-fusion-parser/out/common/NodePositionInterface"
import { LiteralStringNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode'
import { FlowConfigurationPathPartNode } from './FlowConfigurationPathPartNode'

export class FlowConfigurationPathNode extends AbstractNode {
	protected path: FlowConfigurationPathPartNode[] = []

	constructor(path: FlowConfigurationPathPartNode[], position: NodePositionInterface, parent?: AbstractNode | undefined) {
		super(position, parent)

		this.path = path
		for (const part of path) part.parent = this
	}

	static FromLiteralStringNode(literalStringNode: LiteralStringNode) {
		const baseBegin = literalStringNode["position"].begin + 1

		const pathParts = literalStringNode["value"].split(".")
		const pathPartNodes = pathParts.map((pathPart, index) => {
			const offset = pathParts.slice(0, index).join('.').length
			const begin = baseBegin + offset
			const position = { begin, end: begin + pathPart.length + (index > 0 ? 1 : 0) }

			return new FlowConfigurationPathPartNode(pathPart, position)
		})

		return new FlowConfigurationPathNode(pathPartNodes, literalStringNode["position"], literalStringNode)
	}

}