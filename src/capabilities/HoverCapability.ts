import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/eel/nodes/ObjectPathNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueAssignment'
import { EelHelperMethodNode } from '../fusion/EelHelperMethodNode'
import { EelHelperNode } from '../fusion/EelHelperNode'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { LinePositionedNode } from '../LinePositionedNode'
import { ExternalObjectStatement, NodeService } from '../NodeService'
import { abstractNodeToString, findParent, getPrototypeNameFromNode } from '../util'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext } from './CapabilityContext'

export class HoverCapability extends AbstractCapability {

	public run(context: CapabilityContext<any>) {
		const markdown = this.getMarkdownByNode(context.foundNodeByLine, context.parsedFile, context.workspace)
		if (markdown === null) return null

		return {
			contents: { kind: "markdown", value: markdown },
			range: context.foundNodeByLine.getPositionAsRange()
		}
	}

	protected getMarkdownByNode(foundNodeByLine: LinePositionedNode<any>, parsedFile: ParsedFusionFile, workspace: FusionWorkspace) {
		const node = foundNodeByLine.getNode()
		// console.log("node", node)
		this.logVerbose(`FoundNode: ` + node.constructor.name)

		switch (true) {
			case node instanceof FusionObjectValue:
			case node instanceof PrototypePathSegment:
				return this.getMarkdownForPrototypeName(node)
			case node instanceof PathSegment:
				return `property **${node["identifier"]}**`
			case node instanceof EelHelperNode:
				return `EEL-Helper **${(<EelHelperNode>node).identifier}**`
			case node instanceof ObjectFunctionPathNode:
				return `EEL-Function **${(<ObjectPathNode><unknown>node)["value"]}**`
			case node instanceof ObjectPathNode:
				return this.getMarkdownForObjectPath(workspace, foundNodeByLine)
			case node instanceof EelHelperMethodNode:
				return this.getMarkdownForEelHelperMethod(node, workspace)
			default:
				return null // `Type: ${node.constructor.name}`
		}
	}

	getMarkdownForPrototypeName(node: FusionObjectValue | PrototypePathSegment) {
		const prototypeName = getPrototypeNameFromNode(node)
		if (prototypeName === null) return null
		return `prototype **${prototypeName}**`
	}

	getMarkdownForObjectPath(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<any>) {
		const node = foundNodeByLine.getNode()
		const objectNode = node.parent
		if (!(objectNode instanceof ObjectNode)) return null

		if (objectNode.path[0]["value"] === "this" || objectNode.path[0]["value"] === "props") {
			let segment = NodeService.findPropertyDefinitionSegment(objectNode, workspace)
			if (segment instanceof ExternalObjectStatement) {
				segment = <PathSegment>segment.statement.path.segments[0]
			}
			if (segment && segment instanceof PathSegment) {
				const statement = findParent(segment, ObjectStatement)
				if (!statement) return null
				if (!(statement.operation instanceof ValueAssignment)) return null

				const stringified = abstractNodeToString(<any>statement.operation.pathValue)
				if (stringified !== undefined) {
					return [
						`EEL **${(<ObjectPathNode><unknown>node)["value"]}**`,
						'```javascript',
						stringified,
						'```'
					].join('\n')
				}
			}
		}

		return `EEL **${(<ObjectPathNode><unknown>node)["value"]}**`
	}

	getMarkdownForEelHelperMethod(node: EelHelperMethodNode, workspace: FusionWorkspace) {
		let description = undefined

		const eelHelper = workspace.neosWorkspace.getEelHelperTokensByName((<EelHelperMethodNode>node).eelHelper.identifier)
		if (eelHelper) {
			const method = eelHelper.methods.find(method => method.valid((<EelHelperMethodNode>node).identifier))
			if (method) description = method.description
		}

		const header = `EEL-Helper *${(<EelHelperMethodNode>node).eelHelper.identifier}*.**${(<EelHelperMethodNode>node).identifier}**`
		return `${header}` + (description ? '\n\n' + description : '')
	}
}