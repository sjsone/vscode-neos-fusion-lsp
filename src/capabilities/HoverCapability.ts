import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/eel/nodes/ObjectPathNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueAssignment'
import { DefinitionParams } from 'vscode-languageserver/node'
import { EelHelperMethodNode } from '../fusion/EelHelperMethodNode'
import { EelHelperNode } from '../fusion/EelHelperNode'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { LinePositionedNode } from '../LinePositionedNode'
import { NodeService } from '../NodeService'
import { abstractNodeToString, findParent, getPrototypeNameFromNode } from '../util'
import { AbstractCapability } from './AbstractCapability'

export class HoverCapability extends AbstractCapability {
	protected getMarkdownByNode(foundNodeByLine: LinePositionedNode<any>, parsedFile: ParsedFusionFile, workspace: FusionWorkspace) {
		const node = foundNodeByLine.getNode()
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
				return this.getMarkdownForObjectPath(parsedFile, foundNodeByLine)
			case node instanceof EelHelperMethodNode:
				return this.getMarkdownForEelHelperMethod(node, workspace)
			default:
				return null // `Type: ${node.constructor.name}`
		}
	}

	public run(params: DefinitionParams) {
		const line = params.position.line + 1
		const column = params.position.character + 1

		const context = this.buildContextFromUri(params.textDocument.uri, line, column)
		if (context === null) return null

		const nodeBegin = context.foundNodeByLine.getBegin()
		const nodeEnd = context.foundNodeByLine.getEnd()

		const node = context.foundNodeByLine.getNode()
		this.logVerbose(`FoundNode: ` + node.constructor.name)

		const markdown = this.getMarkdownByNode(context.foundNodeByLine, context.parsedFile, context.workspace)
		if (markdown === null) return null

		return {
			contents: { kind: "markdown", value: markdown },
			range: {
				start: { line: nodeBegin.line - 1, character: nodeBegin.column - 1 },
				end: { line: nodeEnd.line - 1, character: nodeEnd.column - 1 }
			}
		}
	}

	getMarkdownForPrototypeName(node: FusionObjectValue | PrototypePathSegment) {
		const prototypeName = getPrototypeNameFromNode(node)
		if (prototypeName === null) return null
		return `prototype **${prototypeName}**`
	}

	getMarkdownForObjectPath(parsedFile: ParsedFusionFile, foundNodeByLine: LinePositionedNode<any>) {
		const node = foundNodeByLine.getNode()
		const objectNode = node.parent
		if (!(objectNode instanceof ObjectNode)) return null

		if (objectNode.path[0]["value"] === "this" || objectNode.path[0]["value"] === "props") {
			const segment = NodeService.findPropertyDefinitionSegment(objectNode)
			if (segment) {
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
			const method = eelHelper.methods.find(method => method.name === (<EelHelperMethodNode>node).identifier)
			if (method) description = method.description
		}

		const header = `EEL-Helper *${(<EelHelperMethodNode>node).eelHelper.identifier}*.**${(<EelHelperMethodNode>node).identifier}**`

		return `${header}` + (description ? '\n\n' + description : '')
	}
}