import * as NodeFs from 'fs'
import * as NodePath from 'path'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { Comment } from 'ts-fusion-parser/out/common/Comment'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { Command, CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { NodeService, ExternalObjectStatement } from '../common/NodeService'
import { findParent } from '../common/util'
import { FlowConfigurationPathPartNode } from '../fusion/FlowConfigurationPathPartNode'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ResourceUriNode } from '../fusion/node/ResourceUriNode'
import { TranslationShortHandNode } from '../fusion/node/TranslationShortHandNode'
import { NeosPackage } from '../neos/NeosPackage'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext'
import { SemanticCommentType } from '../common/SemanticCommentService'
import { RoutingControllerNode } from '../fusion/node/RoutingControllerNode'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'

const BuiltInCompletions = {
	prototypeCompletion: {
		label: 'prototype',
		insertTextFormat: InsertTextFormat.Snippet,
		insertText: 'prototype($1)',
		kind: CompletionItemKind.Keyword,
	}
}

export class CompletionCapability extends AbstractCapability {

	static readonly SuggestCommand: Command = {
		title: 'Trigger Suggest',
		command: 'editor.action.triggerSuggest'
	}

	static readonly ParameterHintsCommand: Command = {
		title: "Trigger Parameter Hints",
		command: "editor.action.triggerParameterHints"
	}

	protected run(context: CapabilityContext<AbstractNode>) {
		const { workspace, foundNodeByLine, parsedFile } = <ParsedFileCapabilityContext<AbstractNode>>context
		const completions: CompletionItem[] = []
		if (foundNodeByLine) {
			const foundNode = foundNodeByLine.getNode()
			this.logDebug(`Autocompleting: ${foundNode.constructor.name}`)
			if (foundNode instanceof PathSegment)
				completions.push(BuiltInCompletions.prototypeCompletion)
			if (foundNode instanceof TagNode)
				completions.push(...this.getTagNodeCompletions(workspace, <LinePositionedNode<TagNode>>foundNodeByLine))
			if (foundNode instanceof TagAttributeNode)
				completions.push(...this.getTagAttributeNodeCompletions(workspace, <LinePositionedNode<TagAttributeNode>>foundNodeByLine))
			if (foundNode instanceof ObjectStatement)
				completions.push(...this.getObjectStatementCompletions(workspace, parsedFile, <LinePositionedNode<ObjectStatement>>foundNodeByLine))
			if (foundNode instanceof FusionObjectValue)
				completions.push(...this.getPrototypeCompletions(workspace, <LinePositionedNode<FusionObjectValue | PrototypePathSegment>>foundNodeByLine))
			if (foundNode instanceof PrototypePathSegment)
				completions.push(...this.getPrototypeCompletions(workspace, <LinePositionedNode<FusionObjectValue | PrototypePathSegment>>foundNodeByLine))
			if (foundNode instanceof ObjectNode)
				completions.push(...this.getFusionPropertyCompletionsForObjectNode(workspace, <LinePositionedNode<ObjectNode>>foundNodeByLine))
			if (foundNode instanceof ObjectPathNode)
				completions.push(...this.getFusionPropertyCompletionsForObjectPath(workspace, <LinePositionedNode<ObjectPathNode>>foundNodeByLine))
			if (foundNode instanceof ResourceUriNode)
				completions.push(...this.getResourceUriCompletions(workspace, <LinePositionedNode<ResourceUriNode>>foundNodeByLine))
			if (foundNode instanceof FlowConfigurationPathPartNode)
				completions.push(...this.getFlowConfigurationCompletions(workspace, <LinePositionedNode<FlowConfigurationPathPartNode>>foundNodeByLine))
			if (foundNode instanceof TranslationShortHandNode)
				completions.push(...this.getTranslationShortHandCompletions(workspace, <LinePositionedNode<TranslationShortHandNode>>foundNodeByLine))
			if (foundNode instanceof Comment)
				completions.push(...this.getSemanticCommentCompletions(<LinePositionedNode<Comment>>foundNodeByLine))
		}

		this.logVerbose(`Found ${completions.length} completions `)

		return completions
	}

	protected getTagNodeCompletions(workspace: FusionWorkspace, foundNode: LinePositionedNode<TagNode>) {
		const completions: CompletionItem[] = []

		const foundNodes = workspace.getNodesByType(PrototypePathSegment)
		if (!foundNodes) return []

		for (const fileNodes of foundNodes) {
			for (const fileNode of fileNodes.nodes) {
				const label = fileNode.getNode().identifier
				if (!completions.find(completion => completion.label === label)) {
					const foundNodeTagStart = { line: foundNode.getBegin().line, character: foundNode.getBegin().character + 1 }
					completions.push({
						label,
						kind: CompletionItemKind.Class,
						insertTextMode: InsertTextMode.adjustIndentation,
						insertText: label,
						textEdit: {
							insert: {
								start: foundNodeTagStart,
								end: foundNode.getEnd(),
							},
							replace: {
								start: foundNodeTagStart,
								end: { line: foundNode.getEnd().line, character: foundNode.getEnd().character + label.length },
							},
							newText: label
						}
					})
				}
			}
		}

		return completions
	}

	protected getTagAttributeNodeCompletions(workspace: FusionWorkspace, foundNode: LinePositionedNode<TagAttributeNode>) {
		const completions: CompletionItem[] = []
		const attributeNode = foundNode.getNode()

		if (attributeNode.value) return completions

		const tagNode = findParent(attributeNode, TagNode)
		if (!tagNode) return completions

		const labels: string[] = []

		const prototypeFusionContext = NodeService.getFusionContextOfPrototype(tagNode.name, workspace)
		if (!prototypeFusionContext) return completions

		for (const propertyName in prototypeFusionContext) {
			if (propertyName.startsWith("__")) continue

			if (!labels.includes(propertyName)) labels.push(propertyName)
		}

		for (const label of labels) completions.push({ label, kind: CompletionItemKind.Property })

		return completions
	}

	protected getObjectStatementCompletions(workspace: FusionWorkspace, parsedFile: ParsedFusionFile, foundNode: LinePositionedNode<ObjectStatement>) {
		const node = foundNode.getNode()


		const routingActionsCompletions = this.getObjectStatementRoutingActionsCompletions(workspace, parsedFile, node)
		if (routingActionsCompletions) return routingActionsCompletions

		if (!(node.operation === null || node.operation.position.begin !== node.operation.position.end)) {
			return this.getPropertyDefinitionSegments(node, workspace)
		}

		// return [BuiltInCompletions.prototypeCompletion, ...this.getPropertyDefinitionSegments(node, workspace)]
		return []
	}

	protected getObjectStatementRoutingActionsCompletions(workspace: FusionWorkspace, parsedFile: ParsedFusionFile, node: ObjectStatement) {
		if (!(node.parent?.parent?.parent instanceof ObjectStatement)) return undefined

		const routingControllerNode = node.parent?.parent?.parent.routingControllerNode
		if (!routingControllerNode) return undefined

		const classDefinition = RoutingControllerNode.getClassDefinitionFromRoutingControllerNode(parsedFile, workspace, routingControllerNode)
		if (!classDefinition) return undefined

		return classDefinition.methods.map(method => {
			return {
				label: method.name,
				insertText: method.name.replace("Action", ""),
				kind: CompletionItemKind.Method
			}
		})
	}

	protected getFusionPropertyCompletionsForObjectPath(workspace: FusionWorkspace, foundNode: LinePositionedNode<ObjectPathNode>): CompletionItem[] {
		const node = foundNode.getNode()
		const objectNode = findParent(node, ObjectNode)
		if (!objectNode) return []
		return this.getFusionPropertyCompletionsForObjectNode(workspace, objectNode.linePositionedNode)
	}

	protected getPropertyDefinitionSegments(objectNode: ObjectStatement, workspace?: FusionWorkspace) {
		const completions: CompletionItem[] = []

		for (const segmentOrExternalStatement of NodeService.findPropertyDefinitionSegments(objectNode, workspace, true)) {
			const segment = segmentOrExternalStatement instanceof ExternalObjectStatement ? segmentOrExternalStatement.statement.path.segments[0] : segmentOrExternalStatement
			completions.push({
				label: segment.identifier,
				kind: CompletionItemKind.Property
			})
		}

		return completions
	}

	protected getPrototypeCompletions(fusionWorkspace: FusionWorkspace, foundNode: LinePositionedNode<FusionObjectValue | PrototypePathSegment>): CompletionItem[] {
		const completions: CompletionItem[] = []

		const foundNodes = fusionWorkspace.getNodesByType(PrototypePathSegment)
		if (!foundNodes) return []

		for (const fileNodes of foundNodes) {
			for (const fileNode of fileNodes.nodes) {
				const label = fileNode.getNode().identifier
				if (!completions.find(completion => completion.label === label)) {
					completions.push(this.createCompletionItem(label, foundNode, CompletionItemKind.Class))
				}
			}
		}



		return completions
	}

	protected getFlowConfigurationCompletions(fusionWorkspace: FusionWorkspace, partNode: LinePositionedNode<FlowConfigurationPathPartNode>): CompletionItem[] {
		const completions: CompletionItem[] = []
		const node = partNode.getNode().parent
		const partIndex = node["path"].indexOf(partNode.getNode())
		if (partIndex === -1) return []

		const pathParts = node["path"].slice(0, partIndex + 1)
		const searchPath = pathParts.map(part => part["value"]).filter(Boolean)
		this.logDebug("searching for ", searchPath)

		for (const neosPackage of fusionWorkspace.neosWorkspace.getPackages().values()) {
			for (const result of neosPackage["configuration"].search(searchPath)) {
				if (typeof result.value === "string") {
					completions.push(this.createCompletionItem(result.value, partNode, CompletionItemKind.Text))
				}

				if (typeof result.value === "object") {
					for (const itemName in result.value) {
						const value = result.value[itemName]
						const isObject = typeof value === "object"

						const label = (searchPath.length > 0 ? '.' : '') + itemName + (isObject ? '.' : '')
						if (completions.find(completion => completion.label === label)) continue

						let type: CompletionItemKind = CompletionItemKind.Value
						if (typeof value === "string") type = CompletionItemKind.Text
						if (isObject) type = CompletionItemKind.Class

						const completion = this.createCompletionItem(label, partNode, type)
						completion.command = CompletionCapability.SuggestCommand
						completions.push(completion)
					}
				}
			}
		}

		return completions
	}

	protected getFusionPropertyCompletionsForObjectNode(workspace: FusionWorkspace, foundNode: LinePositionedNode<ObjectNode>): CompletionItem[] {
		const node = foundNode.getNode()
		const completions: CompletionItem[] = []

		const objectPathParts = node.path.map(segment => segment["value"])
		let fusionContext = NodeService.getFusionContextUntilNode(node, workspace)

		const lastObjectPathNode = node.path.slice().reverse().find(p => !p.incomplete)
		if (lastObjectPathNode?.linePositionedNode) completions.push(...this.getEelHelperCompletionsForObjectPath(workspace, lastObjectPathNode.linePositionedNode, true))

		for (const objectPathPart of objectPathParts) {
			if (!(objectPathPart in fusionContext)) {
				if ("this" in fusionContext && !"this".startsWith(objectPathPart)) delete fusionContext.this
				break
			}
			fusionContext = fusionContext[objectPathPart]
		}

		if (typeof fusionContext !== "object") return completions

		for (const label of Object.keys(fusionContext)) {
			if (label.startsWith('__')) continue

			const restObjectPathParts = objectPathParts.slice(0, -1) ?? []
			completions.push(this.createCompletionItem([...restObjectPathParts, label].join('.'), foundNode, CompletionItemKind.Class))
		}

		return completions
	}

	protected getEelHelperCompletionsForObjectPath(fusionWorkspace: FusionWorkspace, foundNode: LinePositionedNode<ObjectPathNode>, debug: boolean = false): CompletionItem[] {
		const node = foundNode.getNode()
		const objectNode = <ObjectNode>node.parent
		const linePositionedObjectNode = objectNode.linePositionedNode
		const fullPath = objectNode.path.reduce((parts, part) => {
			if (!part.incomplete) parts.push(part.value)
			return parts
		}, [] as string[]).join(".")
		const completions: CompletionItem[] = []

		const eelHelpers = fusionWorkspace.neosWorkspace.getEelHelperTokens()
		for (const eelHelper of eelHelpers) {
			for (const method of eelHelper.methods) {
				if (method.getNormalizedName() === "allowsCallOfMethod") continue
				const fullName = eelHelper.name + "." + method.getNormalizedName()
				if (!fullName.startsWith(fullPath)) continue
				const newText = `${fullName}($1)`
				const completionItem = this.createCompletionItem(fullName, linePositionedObjectNode, CompletionItemKind.Method, newText, CompletionCapability.ParameterHintsCommand)
				completionItem.detail = method.description
				completions.push(completionItem)
			}
		}

		return completions
	}

	protected createCompletionItem(label: string, linePositionedNode: LinePositionedNode<AbstractNode>, kind: CompletionItemKind, newText: string | undefined = undefined, command: Command | undefined = undefined): CompletionItem {
		return {
			label,
			kind,
			insertText: label,
			insertTextMode: InsertTextMode.adjustIndentation,
			insertTextFormat: InsertTextFormat.Snippet,
			textEdit: {
				insert: linePositionedNode.getPositionAsRange(),
				replace: {
					start: linePositionedNode.getBegin(),
					end: { line: linePositionedNode.getEnd().line, character: linePositionedNode.getEnd().character + label.length },
				},
				newText: newText ?? label
			},
			command: command
		}
	}

	protected getResourceUriCompletions(workspace: FusionWorkspace, foundNode: LinePositionedNode<ResourceUriNode>): CompletionItem[] {
		const node = foundNode.getNode()

		const identifierMatch = /resource:\/\/(.*?)\//.exec(node.identifier)
		if (identifierMatch === null) {
			return Array.from(workspace.neosWorkspace.getPackages().values()).map((neosPackage: NeosPackage) => {
				return {
					label: neosPackage.getPackageName(),
					kind: CompletionItemKind.Module,
					insertText: neosPackage.getPackageName() + '/',
					command: CompletionCapability.SuggestCommand
				}
			})
		}
		const packageName = identifierMatch[1]

		const neosPackage = workspace.neosWorkspace.getPackage(packageName)
		if (!neosPackage) return []

		const nextPath = NodePath.join(neosPackage.path, "Resources", node.getRelativePath())
		if (!NodeFs.existsSync(nextPath)) return []

		const completions: CompletionItem[] = []
		const thingsInFolder = NodeFs.readdirSync(nextPath, { withFileTypes: true })
		for (const thing of thingsInFolder) {
			if (thing.isFile()) completions.push({
				label: thing.name,
				kind: CompletionItemKind.File,
				insertText: thing.name,
			})

			if (thing.isDirectory()) completions.push({
				label: thing.name,
				kind: CompletionItemKind.Folder,
				insertText: thing.name + '/',
				command: CompletionCapability.SuggestCommand
			})
		}

		return completions
	}

	protected getTranslationShortHandCompletions(workspace: FusionWorkspace, foundNode: LinePositionedNode<TranslationShortHandNode>): Iterable<CompletionItem> {
		const node = foundNode.getNode()

		const shortHandIdentifier = node.getShortHandIdentifier()
		if (!shortHandIdentifier.packageName) {
			const completions = new Map<string, CompletionItem>()
			for (const translationFile of workspace.translationFiles) {
				const packageName = translationFile.neosPackage.getPackageName()
				if (!completions.has(packageName)) completions.set(packageName, {
					label: packageName,
					kind: CompletionItemKind.Module,
					insertText: packageName + ':',
					command: CompletionCapability.SuggestCommand
				})
			}
			return completions.values()
		}

		const neosPackage = workspace.neosWorkspace.getPackage(shortHandIdentifier.packageName)
		if (!neosPackage) return []

		if (!shortHandIdentifier.sourceName) {
			const completions = new Map<string, CompletionItem>()
			for (const translationFile of workspace.translationFiles) {
				if (translationFile.neosPackage.getPackageName() !== shortHandIdentifier.packageName) continue
				const source = translationFile.sourceParts.join('.')
				if (!completions.has(source)) completions.set(source, {
					label: source,
					kind: CompletionItemKind.Class,
					insertText: source + ':',
					command: CompletionCapability.SuggestCommand
				})
			}
			return completions.values()
		}

		if (!shortHandIdentifier.translationIdentifier) {
			const completions = new Map<string, CompletionItem>()
			for (const translationFile of workspace.translationFiles) {
				if (translationFile.neosPackage.getPackageName() !== shortHandIdentifier.packageName) continue
				if (translationFile.sourceParts.join('.') !== shortHandIdentifier.sourceName) continue
				for (const transUnit of translationFile.transUnits.values()) {
					if (!completions.has(transUnit.id)) completions.set(transUnit.id, {
						label: transUnit.id,
						kind: CompletionItemKind.Class,
						insertText: transUnit.id,
					})
				}
			}
			return completions.values()
		}

		return []
	}

	protected getSemanticCommentCompletions(foundNode: LinePositionedNode<Comment>): CompletionItem[] {
		const completions: CompletionItem[] = []

		const node = foundNode.getNode()
		if (!node.value?.trim().startsWith("@")) return []

		for (const semanticComment of [SemanticCommentType.Ignore, SemanticCommentType.IgnoreBlock]) {
			const label = node.prefix === "//" ? `// ${semanticComment}` : `<!-- ${semanticComment} -->`

			completions.push({
				label,
				kind: CompletionItemKind.Class,
				insertTextMode: InsertTextMode.adjustIndentation,
				insertText: label,
				textEdit: {
					insert: {
						start: foundNode.getBegin(),
						end: foundNode.getEnd(),
					},
					replace: {
						start: foundNode.getBegin(),
						end: { line: foundNode.getEnd().line, character: foundNode.getEnd().character + label.length },
					},
					newText: label
				}
			})
		}



		return completions
	}
}