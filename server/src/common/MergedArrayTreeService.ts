import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { NodeTypeDefinition } from '../neos/FlowConfiguration'
import { LinePositionedNode } from './LinePositionedNode'
import { findParent, getPrototypeNameFromNode } from './util'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/nodes/MetaPathSegment'

class MergedArrayTreeService {

	public buildPathForNode(node: AbstractNode): string[] {
		let nodePath: string[] = []
		do {
			nodePath.unshift(...this.abstractNodeToMergedArrayTreePath(node))
			node = node["parent"]
		} while (node)
		return nodePath
	}

	protected *abstractNodeToMergedArrayTreePath(node: AbstractNode): Generator<string> {
		if (node instanceof ObjectPathNode) {
			const objectNode = <ObjectNode>node["parent"]
			const elements = objectNode.path.slice(0, objectNode.path.indexOf(node) + 1)
			// console.log("elements", elements)
			// yield elements.map(pathNode => pathNode["value"]).join("/")

			// return
		}

		// if (node instanceof ObjectNode) yield "<skip:ObjectNode>"
		// if (node instanceof ObjectNode) return

		if (node instanceof ObjectStatement) {
			for (const segment of node["path"]["segments"]) {
				if (segment instanceof PathSegment) yield segment.identifier
				if (segment instanceof PrototypePathSegment) yield `<${segment.identifier}>`
				if (segment instanceof MetaPathSegment) {
					yield "__meta"
					yield segment.identifier
				}
			}
		}

		// 'ObjectNode',
		// 'EelExpressionValue',
		// 'ValueAssignment',
		// 'ObjectStatement',
		// 'StatementList',
		// 'Block',
		// 'ObjectStatement',
		// 'StatementList',
		// 'Block',
		// 'ObjectStatement',
		// 'StatementList',
		// 'FusionFile'


		// yield `<todo:${node.constructor.name}>`
	}
}

const mergedArrayTreeService = new MergedArrayTreeService
export { MergedArrayTreeService as MergedArrayTreeServiceClass, mergedArrayTreeService as MergedArrayTreeService }
