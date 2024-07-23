import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { CompletionItem, CompletionItemKind, CompletionList, CompletionParams, Definition, DefinitionParams, InsertTextMode, LocationLink } from 'vscode-languageserver'
import { ActionUriPartTypes, ActionUriService } from '../common/ActionUriService'
import { LegacyNodeService } from '../common/LegacyNodeService'
import { NodeService } from '../common/NodeService'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { findParent, getObjectIdentifier } from '../common/util'
import { NeosFusionFormActionNode } from '../fusion/node/NeosFusionFormActionNode'
import { NeosFusionFormControllerNode } from '../fusion/node/NeosFusionFormControllerNode'
import { ElementTextDocumentContext } from './ElementContext'
import { ElementFunctionalityInterface, ElementInterface } from './ElementInterface'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'

export class AfxTagElement implements ElementInterface<TagAttributeNode | TagNode> {

	isResponsible(methodName: keyof ElementFunctionalityInterface<AbstractNode>, node: AbstractNode | undefined): boolean {
		if (methodName === "onDefinition") return node instanceof TagAttributeNode
		return node instanceof TagAttributeNode || node instanceof TagNode
	}

	async onDefinition(context: ElementTextDocumentContext<DefinitionParams, TagAttributeNode>): Promise<LocationLink[] | Definition | null | undefined> {
		// TODO: move into something like getAfxTagAttributeDefinition()
		if (!context.foundNodeByLine) return []

		const node = context.foundNodeByLine.getNode()
		const tagNode = findParent(node, TagNode)
		if (!tagNode) return []

		const locationLinks: LocationLink[] = []
		const nodePositionBegin = context.foundNodeByLine.getBegin()
		const originSelectionRange = {
			start: nodePositionBegin,
			end: {
				line: nodePositionBegin.line,
				character: nodePositionBegin.character + node.name.length
			}
		}

		const prototypeFusionContext = NodeService.getFusionContextOfPrototype(tagNode.name, context.workspace)
		if (!prototypeFusionContext) return []

		for (const propertyName in prototypeFusionContext) {
			if (propertyName !== node.name) continue

			const nodes: undefined | Array<AbstractNode> = prototypeFusionContext?.[propertyName].__nodes
			if (!nodes) continue

			for (const node of nodes) {
				const statement = findParent(node, ObjectStatement)
				if (!statement) continue

				locationLinks.unshift({
					targetUri: statement.fileUri,
					targetRange: statement.linePositionedNode.getPositionAsRange(),
					targetSelectionRange: statement.linePositionedNode.getPositionAsRange(),
					originSelectionRange
				})

				// TODO: make it configurable if all definitions should be provided
				break
			}
		}

		locationLinks.forEach(l => console.log(l.targetUri));

		const foundNodes = context.parsedFile.getNodesByPosition(context.params.position)
		if (!foundNodes) return locationLinks

		const neosFusionFormPartNode = <LinePositionedNode<NeosFusionFormActionNode | NeosFusionFormControllerNode>>foundNodes.find(positionedNode => (positionedNode.getNode() instanceof NeosFusionFormActionNode || positionedNode.getNode() instanceof NeosFusionFormControllerNode))
		if (neosFusionFormPartNode !== undefined) {
			const neosFusionFormDefinitionNode = neosFusionFormPartNode.getNode().parent

			const definitionTargetName = neosFusionFormPartNode.getNode() instanceof NeosFusionFormActionNode ? ActionUriPartTypes.Action : ActionUriPartTypes.Controller

			const resolvedDefinition = ActionUriService.resolveFusionFormDefinitionNode(node, neosFusionFormDefinitionNode, definitionTargetName, context.workspace, context.parsedFile)
			if (resolvedDefinition) locationLinks.push(...resolvedDefinition)
		}

		return locationLinks
	}

	async onCompletion(context: ElementTextDocumentContext<CompletionParams, TagAttributeNode | TagNode>): Promise<CompletionItem[] | CompletionList | null | undefined> {
		if (context.foundNodeByLine!.getNode() instanceof TagAttributeNode) return this.getTagAttributeNodeCompletions(context.workspace, <LinePositionedNode<TagAttributeNode>>context.foundNodeByLine!)
		if (context.foundNodeByLine!.getNode() instanceof TagNode) return this.getTagNodeCompletions(context.workspace, <LinePositionedNode<TagNode>>context.foundNodeByLine!)
		return null
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
		if (tagNode !== undefined) {
			const labels: string[] = []
			// for (const statement of LegacyNodeService.getInheritedPropertiesByPrototypeName(tagNode.name, workspace)) {
			// 	const label = getObjectIdentifier(statement.statement)
			// 	if (!labels.includes(label)) labels.push(label)
			// }

			for (const label of labels) completions.push({ label, kind: CompletionItemKind.Property })
		}

		return completions
	}

}