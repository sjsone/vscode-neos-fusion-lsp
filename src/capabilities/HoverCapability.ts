import * as NodePath from 'path'
import * as NodeFs from 'fs'

import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/eel/nodes/ObjectPathNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueAssignment'
import { PhpClassMethodNode } from '../fusion/PhpClassMethodNode'
import { PhpClassNode } from '../fusion/PhpClassNode'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { LinePositionedNode } from '../LinePositionedNode'
import { ExternalObjectStatement, NodeService } from '../NodeService'
import { abstractNodeToString, findParent, getPrototypeNameFromNode } from '../util'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext } from './CapabilityContext'
import { ResourceUriNode } from '../fusion/ResourceUriNode'

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
		// return `Type: ${node.constructor.name}`
		this.logVerbose(`FoundNode: ` + node.constructor.name)

		switch (true) {
			case node instanceof FusionObjectValue:
			case node instanceof PrototypePathSegment:
				return this.getMarkdownForPrototypeName(workspace, node)
			case node instanceof PathSegment:
				return `property **${node["identifier"]}**`
			case node instanceof PhpClassNode:
				return `EEL-Helper **${(<PhpClassNode>node).identifier}**`
			case node instanceof ObjectFunctionPathNode:
				return `EEL-Function **${(<ObjectPathNode><unknown>node)["value"]}**`
			case node instanceof ObjectPathNode:
				return this.getMarkdownForObjectPath(workspace, foundNodeByLine)
			case node instanceof PhpClassMethodNode:
				return this.getMarkdownForEelHelperMethod(node, workspace)
			case node instanceof ResourceUriNode:
				return this.getMarkdownForResourceUri(node, workspace)
			default:
				return null
		}
	}

	getMarkdownForPrototypeName(workspace: FusionWorkspace, node: FusionObjectValue | PrototypePathSegment) {
		const prototypeName = getPrototypeNameFromNode(node)
		if (prototypeName === null) return null

		const statementsNames: string[] = []
		for (const otherParsedFile of workspace.parsedFiles) {
			for (const otherPositionedNode of [...otherParsedFile.prototypeCreations, ...otherParsedFile.prototypeOverwrites]) {
				const otherNode = <PrototypePathSegment>otherPositionedNode.getNode()
				if (otherNode["identifier"] !== prototypeName) continue

				const otherObjectStatement = findParent(otherNode, ObjectStatement)
				if (!otherObjectStatement.block) continue

				for (const statement of <ObjectStatement[]>otherObjectStatement.block.statementList.statements) {
					let statementName = statement["path"].segments.map(abstractNodeToString).filter(Boolean).join(".")
					if (statement.operation instanceof ValueAssignment) {
						statementName += ` = ${abstractNodeToString(<any>statement.operation.pathValue)}`
					}

					statementsNames.push(statementName)
				}
			}
		}

		const statementsNamesMarkdown = statementsNames.length > 0 ? "\n" + statementsNames.map(name => `  ${name}`).join("\n") + "\n" : " "
		return [
			"```",
			`prototype(${prototypeName}) {${statementsNamesMarkdown}}`,
			"```"
		].join("\n")
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
				const name = (<ObjectPathNode><unknown>node)["value"]
				if (stringified !== undefined) {
					return [
						`EEL **${name}**`,
						'```fusion',
						`${name} = ${stringified}`,
						'```'
					].join('\n')
				}
			}
		}

		return `EEL **${(<ObjectPathNode><unknown>node)["value"]}**`
	}

	getMarkdownForEelHelperMethod(node: PhpClassMethodNode, workspace: FusionWorkspace) {
		let description = undefined

		const eelHelper = workspace.neosWorkspace.getEelHelperTokensByName((<PhpClassMethodNode>node).eelHelper.identifier)
		if (eelHelper) {
			const method = eelHelper.methods.find(method => method.valid((<PhpClassMethodNode>node).identifier))
			if (method) description = method.description
		}

		const header = `EEL-Helper *${(<PhpClassMethodNode>node).eelHelper.identifier}*.**${(<PhpClassMethodNode>node).identifier}**`
		return `${header}` + (description ? '\n\n' + description : '')
	}

	getMarkdownForResourceUri(node: ResourceUriNode, workspace: FusionWorkspace) {
		if (!node.canBeFound()) return null
		const uri = workspace.neosWorkspace.getResourceUriPath(node.getNamespace(), node.getRelativePath())
		if (!uri || !NodeFs.existsSync(uri)) return `**Could not find Resource**`

		const basename = NodePath.basename(uri)
		const isImage = (/\.(gif|jpe?g|tiff?|png|webp|bmp)$/i).test(basename)

		if (isImage) return `![${basename}](${uri})`
		return `Resource: ${basename}`
	}
}