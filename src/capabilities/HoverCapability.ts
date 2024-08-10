import * as NodeFs from 'fs'
import * as NodePath from 'path'

import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { PropertyDocumentationDefinition } from 'ts-fusion-parser/out/fusion/nodes/PropertyDocumentationDefinition'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import * as YAML from 'yaml'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { NodeService } from '../common/NodeService'
import { XLIFFService } from '../common/XLIFFService'
import { abstractNodeToString, findParent, getPrototypeNameFromNode } from '../common/util'
import { FlowConfigurationPathPartNode } from '../fusion/FlowConfigurationPathPartNode'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { PhpClassMethodNode } from '../fusion/node/PhpClassMethodNode'
import { PhpClassNode } from '../fusion/node/PhpClassNode'
import { ResourceUriNode } from '../fusion/node/ResourceUriNode'
import { TranslationShortHandNode } from '../fusion/node/TranslationShortHandNode'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext'
import { Nodes } from 'ts-fusion-parser'
import { MergedArrayTreeService } from '../common/MergedArrayTreeService'


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

		if (node instanceof FlowConfigurationPathPartNode)
			return this.getMarkdownForFlowConfigurationPathNode(workspace, node)
		if (node instanceof TranslationShortHandNode)
			return this.getMarkdownForTranslationShortHandNode(workspace, <LinePositionedNode<TranslationShortHandNode>>foundNodeByLine)
		if (node instanceof FusionObjectValue)
			return this.getMarkdownForPrototypeName(workspace, <FusionObjectValue | PrototypePathSegment>node)
		if (node instanceof PrototypePathSegment)
			return this.getMarkdownForPrototypeName(workspace, <FusionObjectValue | PrototypePathSegment>node)
		if (node instanceof PathSegment)
			return this.getMarkdownForPathSegment(node, workspace)
		if (node instanceof PhpClassNode)
			return `EEL-Helper **${node.identifier}**`
		if (node instanceof ObjectFunctionPathNode)
			return `EEL-Function **${node.value}**`
		if (node instanceof ObjectPathNode)
			return this.getMarkdownForObjectPath(workspace, <LinePositionedNode<ObjectPathNode>>foundNodeByLine)
		if (node instanceof PhpClassMethodNode)
			return this.getMarkdownForEelHelperMethod(node, workspace)
		if (node instanceof ResourceUriNode)
			return this.getMarkdownForResourceUri(node, workspace)

		return null
	}

	protected * createStatementNamesFromPrototypeNode(prototypeName: string, positionedPrototypeNode: LinePositionedNode<PrototypePathSegment>) {
		const prototypeNode = positionedPrototypeNode.getNode()
		if (prototypeNode.identifier !== prototypeName) return

		const otherObjectStatement = findParent(prototypeNode, ObjectStatement)
		if (!otherObjectStatement?.block) return

		for (const statement of otherObjectStatement.block.statementList.statements) {
			if (statement instanceof ObjectStatement) {
				let statementName = statement.path.segments.map(abstractNodeToString).filter(Boolean).join(".")
				if (statement.operation instanceof ValueAssignment) {
					statementName += ` = ${abstractNodeToString(statement.operation.pathValue)}`
				}
				yield statementName
				continue
			}
			if (statement instanceof PropertyDocumentationDefinition) {
				yield `/// ${statement.type} ${statement.text}`
			}
		}
	}

	getMarkdownForFlowConfigurationPathNode(workspace: FusionWorkspace, partNode: FlowConfigurationPathPartNode) {
		const node = partNode.parent

		const partIndex = node["path"].indexOf(partNode)
		if (partIndex === -1) return []

		const pathParts = node["path"].slice(0, partIndex + 1)
		const searchPath = pathParts.map(part => part["value"]).join(".")
		this.logDebug("searching for ", searchPath)

		const results: string[] = []
		for (const result of workspace.neosWorkspace["configurationManager"].search(searchPath)) {
			const fileUri = result.file["uri"]
			const neosPackage = workspace.neosWorkspace.getPackageByUri(fileUri)
			const packageName = neosPackage?.getPackageName() ?? 'Project Configuration'
			results.push(`# [${packageName}] ${NodePath.basename(fileUri)}`)
			results.push(YAML.stringify(result.value, undefined, 3))
		}
		if (results.length === 0) return `_no value found_`

		return [
			"```yaml",
			...results,
			"```"
		].join("\n")
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

		const externalObjectStatement = NodeService.findPropertyDefinitionSegment(objectNode, workspace, true)
		const segment = <PathSegment>externalObjectStatement?.statement.path.segments[0]
		if (segment && segment instanceof PathSegment) {
			const statement = findParent(segment, ObjectStatement)
			if (!statement) return null
			if (!(statement.operation instanceof ValueAssignment)) return null

			const documentationDefinition = statement.documentationDefinition
			if (!documentationDefinition) return `EEL **${node.value}**`

			return [
				documentationDefinition.text,
				"```fusion",
				`/// ${documentationDefinition.type}`,
				"```"
			].join("\n")
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

	getMarkdownForResourceUri(node: ResourceUriNode, workspace: FusionWorkspace) {
		if (!node.canBeFound()) return null
		const path = workspace.neosWorkspace.getResourceUriPath(node.getNamespace(), node.getRelativePath())
		if (!path || !NodeFs.existsSync(path)) return `**Could not find Resource**`

		const basename = NodePath.basename(path)
		const isImage = (/\.(gif|jpe?g|tiff?|png|webp|bmp|svg|ico|icns)$/i).test(basename)

		if (isImage) return `![${basename}](${path})`
		return `Resource: ${basename}`
	}

	getMarkdownForPathSegment(node: PathSegment, workspace: FusionWorkspace) {
		// console.log("Hovering", node.identifier)
		const objectStatement = findParent(node, ObjectStatement)
		if (!objectStatement) return null

		const pathForNode = MergedArrayTreeService.buildPathForNode(node).slice(1)
		// console.log("pathForNode", pathForNode)

		const configurationList = NodeService.getFusionConfigurationListUntilNode(node, workspace)
		const configuration = configurationList[0]?.configuration
		if (!configuration) return null

		let relevantConfiguration = configuration
		for (const part of pathForNode) {
			if (!(part in relevantConfiguration)) return null
			relevantConfiguration = relevantConfiguration[part]
		}

		const relevantNodes = relevantConfiguration?.__nodes as Array<AbstractNode>
		if (!relevantNodes) return null

		for (const relevantNode of relevantNodes) {
			const relevantObjectStatement = findParent(relevantNode, ObjectStatement)
			if (!relevantObjectStatement) continue
			const documentationDefinition = relevantObjectStatement.documentationDefinition
			if (!documentationDefinition) continue

			return [
				documentationDefinition.text,
				"```fusion",
				`/// ${documentationDefinition.type}`,
				"```"
			].join("\n")
		}


		return null
	}
}