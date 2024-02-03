
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { ExternalObjectStatement, LegacyNodeService } from '../common/LegacyNodeService'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { abstractNodeToString, findParent } from '../common/util'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { PhpClassMethodNode } from '../fusion/node/PhpClassMethodNode'
import { PhpClassNode } from '../fusion/node/PhpClassNode'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext'


export class HoverCapability extends AbstractCapability {

	public async run(context: CapabilityContext<AbstractNode>) {
		const { workspace, parsedFile, foundNodeByLine } = <ParsedFileCapabilityContext<AbstractNode>>context
		if (!foundNodeByLine) return null

		const markdown = await this.getMarkdownByNode(foundNodeByLine, parsedFile, workspace)
		if (markdown === null) return null

		return {
			contents: { kind: "markdown", value: markdown },
			range: foundNodeByLine.getPositionAsRange()
		}
	}

	protected getMarkdownByNode(foundNodeByLine: LinePositionedNode<AbstractNode>, parsedFile: ParsedFusionFile, workspace: FusionWorkspace) {
		const node = foundNodeByLine.getNode()
		// return `Type: ${node.constructor.name}`
		this.logVerbose(`FoundNode: ` + node.constructor.name)

		if (node instanceof PathSegment)
			return `property **${node.identifier}**`
		if (node instanceof PhpClassNode)
			return `EEL-Helper **${node.identifier}**`
		if (node instanceof ObjectFunctionPathNode)
			return `EEL-Function **${node.value}**`
		if (node instanceof ObjectPathNode)
			return this.getMarkdownForObjectPath(workspace, <LinePositionedNode<ObjectPathNode>>foundNodeByLine)
		if (node instanceof PhpClassMethodNode)
			return this.getMarkdownForEelHelperMethod(<PhpClassMethodNode>node, workspace)

		return null
	}

	getMarkdownForObjectPath(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<ObjectPathNode>) {
		const node = foundNodeByLine.getNode()
		const objectNode = node.parent
		if (!(objectNode instanceof ObjectNode)) return null

		if ((objectNode.path[0].value !== "this" && objectNode.path[0].value !== "props") || objectNode.path.length < 2) return null

		let segment = LegacyNodeService.findPropertyDefinitionSegment(objectNode, workspace, true)
		if (segment instanceof ExternalObjectStatement) {
			segment = <PathSegment>segment.statement.path.segments[0]
		}
		if (segment && segment instanceof PathSegment) {
			const statement = findParent(segment, ObjectStatement)
			if (!statement) return null
			if (!(statement.operation instanceof ValueAssignment)) return null

			const stringified = abstractNodeToString(statement.operation.pathValue)
			const name = node.value
			if (stringified !== undefined) {
				return [
					`EEL **${name}**`,
					'```fusion',
					`${name} = ${stringified}`,
					'```'
				].join('\n')
			}
		}

		return `EEL **${node.value}**`
	}

	getMarkdownForEelHelperMethod(node: PhpClassMethodNode, workspace: FusionWorkspace) {
		const header = `EEL-Helper *${node.eelHelper.identifier}*.**${node.identifier}** \n`

		const eelHelper = workspace.neosWorkspace.getEelHelperTokensByName(node.eelHelper.identifier)
		if (eelHelper) {
			const method = eelHelper.methods.find(method => method.valid(node.identifier))
			if (method) {

				const phpParameters = method.parameters.map(p => `${p.type ?? ''}${p.name}${p.defaultValue ?? ''}`).join(", ")

				return [
					header,
					method.description,
					'```php',
					`<?php`,
					`${method.name}(${phpParameters})`,
					'```'
				].join('\n')
			}
		}

		return header
	}
}