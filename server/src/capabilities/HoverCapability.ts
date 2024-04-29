import * as NodeFs from 'fs'
import * as NodePath from 'path'

import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { ExternalObjectStatement, NodeService } from '../common/NodeService'
import { XLIFFService } from '../common/XLIFFService'
import { abstractNodeToString, findParent, getPrototypeNameFromNode } from '../common/util'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { PhpClassMethodNode } from '../fusion/node/PhpClassMethodNode'
import { PhpClassNode } from '../fusion/node/PhpClassNode'
import { ResourceUriNode } from '../fusion/node/ResourceUriNode'
import { TranslationShortHandNode } from '../fusion/node/TranslationShortHandNode'
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

		if (node instanceof TranslationShortHandNode) return this.getMarkdownForTranslationShortHandNode(workspace, <LinePositionedNode<TranslationShortHandNode>>foundNodeByLine)
		if (node instanceof FusionObjectValue) return this.getMarkdownForPrototypeName(workspace, <FusionObjectValue | PrototypePathSegment>node)
		if (node instanceof PrototypePathSegment) return this.getMarkdownForPrototypeName(workspace, <FusionObjectValue | PrototypePathSegment>node)
		if (node instanceof PathSegment) return `property **${node.identifier}**`
		if (node instanceof PhpClassNode) return `EEL-Helper **${node.identifier}**`
		if (node instanceof ObjectFunctionPathNode) return `EEL-Function **${node.value}**`
		if (node instanceof ObjectPathNode) return this.getMarkdownForObjectPath(workspace, <LinePositionedNode<ObjectPathNode>>foundNodeByLine)
		if (node instanceof PhpClassMethodNode) return this.getMarkdownForEelHelperMethod(node, workspace)
		if (node instanceof ResourceUriNode) return this.getMarkdownForResourceUri(node, workspace)

		return null
	}

	protected * createStatementNamesFromPrototypeNode(prototypeName: string, positionedPrototypeNode: LinePositionedNode<PrototypePathSegment>) {
		const prototypeNode = positionedPrototypeNode.getNode()
		if (prototypeNode.identifier !== prototypeName) return

		const otherObjectStatement = findParent(prototypeNode, ObjectStatement)
		if (!otherObjectStatement?.block) return

		for (const statement of <ObjectStatement[]>otherObjectStatement.block.statementList.statements) {
			let statementName = statement.path.segments.map(abstractNodeToString).filter(Boolean).join(".")
			if (statement.operation instanceof ValueAssignment) {
				statementName += ` = ${abstractNodeToString(statement.operation.pathValue)}`
			}
			yield statementName
		}
	}

	async getMarkdownForTranslationShortHandNode(workspace: FusionWorkspace, linePositionedNode: LinePositionedNode<TranslationShortHandNode>) {
		const shortHandIdentifier = XLIFFService.readShortHandIdentifier(linePositionedNode.getNode().getValue())
		const translationFiles = await XLIFFService.getMatchingTranslationFiles(workspace, shortHandIdentifier)

		const translationMarkdowns: { isSource: boolean, markdown: string }[] = []
		for (const translationFile of translationFiles) {
			const transUnit = await translationFile.getId(shortHandIdentifier.translationIdentifier)
			if (!transUnit) continue

			const isSource = transUnit.target === undefined
			const position = transUnit.position
			const uri = translationFile.uri + '#L' + (position.line + 1) + ',' + (position.character + 1)

			translationMarkdowns.push({
				isSource,
				markdown: [
					`**[${translationFile.language}](${uri})** ${isSource ? "Source" : ""}`,
					"```\n" + (isSource ? transUnit.source : transUnit.target) + "\n```\n---\n"
				].join("\n")
			})
		}

		translationMarkdowns.sort((a, b) => {
			if (a.isSource && !b.isSource) return -1
			if (!a.isSource && b.isSource) return 1
			return 0
		})

		return translationMarkdowns.map(translationMarkdowns => translationMarkdowns.markdown).join("\n")
	}

	getMarkdownForPrototypeName(workspace: FusionWorkspace, node: FusionObjectValue | PrototypePathSegment) {
		const prototypeName = getPrototypeNameFromNode(node)
		if (prototypeName === null) return null

		const statementsNames: string[] = []
		for (const otherParsedFile of workspace.parsedFiles) {
			const statementsNamesFromFile: string[] = []
			for (const otherPositionedNode of [...otherParsedFile.prototypeCreations, ...otherParsedFile.prototypeOverwrites]) {
				for (const statementName of this.createStatementNamesFromPrototypeNode(prototypeName, otherPositionedNode)) {
					statementsNamesFromFile.push(statementName)
				}
			}
			if (statementsNamesFromFile.length === 0) continue

			const packageName = workspace.neosWorkspace.getPackageByUri(otherParsedFile.uri)?.getPackageName() ?? 'unknown package'
			statementsNames.push(`// [${packageName}] ${NodePath.basename(otherParsedFile.uri)}`)
			statementsNames.push(...statementsNamesFromFile)
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
		const objectNode = node.parent
		if (!(objectNode instanceof ObjectNode)) return null

		if ((objectNode.path[0].value !== "this" && objectNode.path[0].value !== "props") || objectNode.path.length < 2) return null

		let segment = NodeService.findPropertyDefinitionSegment(objectNode, workspace, true)
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
		if (!eelHelper) return header

		const method = eelHelper.methods.find(method => method.valid(node.identifier))
		if (!method) return header

		const phpParameters = method.parameters.map(p => `${p.type ?? ''}${p.name}${p.defaultValue ?? ''}`).join(", ")

		const descriptionParts: string[] = []
		if (method.description) {
			descriptionParts.push('##### Description:')
			descriptionParts.push(method.description?.replace("Example::", '##### Example:'))
		}

		return [
			`#### \`${node.eelHelper.identifier}.${node.identifier} \``,
			...descriptionParts,
			'##### Signature:',
			'```php',
			`<?php`,
			`${method.name}(${phpParameters})${method.returnType ? ': ' + method.returnType : ''}`,
			`?>`,
			'```'
		].join('\n')
	}

	getMarkdownForResourceUri(node: ResourceUriNode, workspace: FusionWorkspace) {
		if (!node.canBeFound()) return null

		const path = workspace.neosWorkspace.getResourceUriPath(node.getNamespace(), node.getRelativePath())
		if (!path || !NodeFs.existsSync(path)) return `**Could not find Resource**`

		const basename = NodePath.basename(path)
		const isImage = (/\.(gif|jpe?g|tiff?|png|webp|bmp|svg|ico|icns)$/i).test(basename)

		if (isImage) return `![${basename}](${path})`
		return `Resource: ${basename}`
	}
}