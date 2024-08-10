import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/nodes/MetaPathSegment'
import { ObjectPath } from 'ts-fusion-parser/out/fusion/nodes/ObjectPath'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'

class MergedArrayTreeService {

	public buildPathForNode(node: AbstractNode): string[] {
		const nodePath: string[] = []
		let foundNode: AbstractNode | undefined = node
		do {
			const result = this.abstractNodeToMergedArrayTreePath(foundNode)
			nodePath.unshift(...result.paths)
			foundNode = result.nextNode
		} while (foundNode)
		return nodePath
	}

	protected abstractNodeToMergedArrayTreePath(node: AbstractNode) {
		let nextNode: AbstractNode | undefined = node.parent
		let paths: Array<string> = []
		if (node instanceof PathSegment) {
			const objectPath = node.parent as ObjectPath
			const nodeIndex = objectPath.segments.indexOf(node)
			const segmentsUntilNode = objectPath.segments.slice(0, nodeIndex + 1)
			// node.parent  => ObjectPath
			// node.parent.parent => ObjectStatement
			nextNode = node.parent?.parent?.parent
			paths = segmentsUntilNode.map(n => n.identifier)
		}
		// if (node instanceof ObjectPathNode) {
		// 	const objectNode = node.parent
		// 	if (objectNode instanceof ObjectNode) {
		// 		const elements = objectNode.path.slice(0, objectNode.path.indexOf(node) + 1)
		// 	}
		// 	// console.log("elements", elements)
		// 	// yield elements.map(pathNode => pathNode["value"]).join("/")

		// 	// return
		// }

		// if (node instanceof ObjectNode) yield "<skip:ObjectNode>"
		// if (node instanceof ObjectNode) return

		if (node instanceof ObjectStatement) {
			for (const segment of node["path"]["segments"]) {
				if (segment instanceof PathSegment) paths.push(segment.identifier)
				if (segment instanceof PrototypePathSegment) paths.push(`<${segment.identifier}>`)
				if (segment instanceof MetaPathSegment) {
					paths.push("__meta")
					paths.push(segment.identifier)
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

		return {
			nextNode,
			paths
		}
	}
}

const mergedArrayTreeService = new MergedArrayTreeService
export { mergedArrayTreeService as MergedArrayTreeService, MergedArrayTreeService as MergedArrayTreeServiceClass }
