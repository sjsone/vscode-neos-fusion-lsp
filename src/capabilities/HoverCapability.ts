import * as NodePath from 'path'
import * as NodeFs from 'fs'

import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueAssignment'
import { PhpClassMethodNode } from '../fusion/PhpClassMethodNode'
import { PhpClassNode } from '../fusion/PhpClassNode'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { ExternalObjectStatement, NodeService } from '../common/NodeService'
import { abstractNodeToString, findParent, getPrototypeNameFromNode } from '../util'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext'
import { ResourceUriNode } from '../fusion/ResourceUriNode'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'

export class HoverCapability extends AbstractCapability {

	public run(context: CapabilityContext<AbstractNode>) {
		const { workspace, parsedFile, foundNodeByLine } = <ParsedFileCapabilityContext<AbstractNode>>context

		const markdown = this.getMarkdownByNode(foundNodeByLine, parsedFile, workspace)
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

		switch (true) {
			case node instanceof FusionObjectValue:
			case node instanceof PrototypePathSegment:
				return this.getMarkdownForPrototypeName(workspace, <FusionObjectValue | PrototypePathSegment>node)
			case node instanceof PathSegment:
				return `property **${node["identifier"]}**`
			case node instanceof PhpClassNode:
				return `EEL-Helper **${node["identifier"]}**`
			case node instanceof ObjectFunctionPathNode:
				return `EEL-Function **${node["value"]}**`
			case node instanceof ObjectPathNode:
				return this.getMarkdownForObjectPath(workspace, <LinePositionedNode<ObjectPathNode>>foundNodeByLine)
			case node instanceof PhpClassMethodNode:
				return this.getMarkdownForEelHelperMethod(<PhpClassMethodNode>node, workspace)
			case node instanceof ResourceUriNode:
				return this.getMarkdownForResourceUri(<ResourceUriNode>node, workspace)
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
						statementName += ` = ${abstractNodeToString(statement.operation.pathValue)}`
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

	getMarkdownForObjectPath(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<ObjectPathNode>) {
		const node = foundNodeByLine.getNode()
		const objectNode = node["parent"]
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

				const stringified = abstractNodeToString(statement.operation.pathValue)
				const name = node["value"]
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

		return `EEL **${node["value"]}**`
	}

	getMarkdownForEelHelperMethod(node: PhpClassMethodNode, workspace: FusionWorkspace) {
		const header = `EEL-Helper *${(<PhpClassMethodNode>node).eelHelper.identifier}*.**${(<PhpClassMethodNode>node).identifier}** \n`

		const eelHelper = workspace.neosWorkspace.getEelHelperTokensByName((<PhpClassMethodNode>node).eelHelper.identifier)
		if (eelHelper) {
			const method = eelHelper.methods.find(method => method.valid((<PhpClassMethodNode>node).identifier))
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

	getMarkdownForResourceUri(node: ResourceUriNode, workspace: FusionWorkspace) {
		if (!node.canBeFound()) return null
		const uri = workspace.neosWorkspace.getResourceUriPath(node.getNamespace(), node.getRelativePath())
		if (!uri || !NodeFs.existsSync(uri)) return `**Could not find Resource**`

		const basename = NodePath.basename(uri)
		const isImage = (/\.(gif|jpe?g|tiff?|png|webp|bmp|svg|ico|icns)$/i).test(basename)

		if (isImage) return `![${basename}](${uri})`
		return `Resource: ${basename}`
	}
}