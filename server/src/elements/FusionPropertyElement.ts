import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { CompletionItem, CompletionItemKind, CompletionList, CompletionParams, Definition, DefinitionParams, Hover, HoverParams, InsertTextFormat, LocationLink } from 'vscode-languageserver'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { ExternalObjectStatement, NodeService } from '../common/NodeService'
import { findParent } from '../common/util'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { RoutingControllerNode } from '../fusion/node/RoutingControllerNode'
import { ElementTextDocumentContext } from './ElementContext'
import { ElementHelper } from './ElementHelper'
import { ElementFunctionalityInterface, ElementInterface } from './ElementInterface'

const BuiltInCompletions = {
	prototypeCompletion: {
		label: 'prototype',
		insertTextFormat: InsertTextFormat.Snippet,
		insertText: 'prototype($1)',
		kind: CompletionItemKind.Keyword,
	}
}

export class FusionPropertyElement implements ElementInterface<PathSegment | ObjectNode | ObjectPathNode | ObjectStatement> {
	isResponsible(methodName: keyof ElementFunctionalityInterface<AbstractNode>, node: AbstractNode | undefined): boolean {
		if (methodName === "onDefinition") return node instanceof PathSegment || node instanceof ObjectPathNode
		return node instanceof PathSegment || node instanceof ObjectNode || node instanceof ObjectPathNode || node instanceof ObjectStatement
	}

	async onDefinition(context: ElementTextDocumentContext<DefinitionParams, PathSegment | ObjectPathNode>): Promise<LocationLink[] | Definition | null | undefined> {
		// PathSegment
		// ObjectPathNode

		if (!context.foundNodeByLine) return undefined

		const node = context.foundNodeByLine.getNode()

		const relevantParentType = node instanceof ObjectPathNode ? ObjectNode : ObjectStatement

		const objectNodeOrStatement = findParent(node, relevantParentType)
		if (!objectNodeOrStatement) return null

		const segment = NodeService.findPropertyDefinitionSegment(objectNodeOrStatement, context.workspace, true, false)
		if (!segment) return null

		const firstSegment = segment.statement.path.segments[0]
		return [{
			uri: firstSegment.fileUri,
			range: firstSegment.linePositionedNode.getPositionAsRange()
		}]
	}

	async onCompletion(context: ElementTextDocumentContext<CompletionParams, AbstractNode>): Promise<CompletionItem[] | CompletionList | null | undefined> {
		const foundNode = context.foundNodeByLine!.getNode()

		if (foundNode instanceof PathSegment)
			return [BuiltInCompletions.prototypeCompletion]
		if (foundNode instanceof ObjectStatement)
			return this.getObjectStatementCompletions(context.workspace, context.parsedFile, <LinePositionedNode<ObjectStatement>>context.foundNodeByLine!)
		if (foundNode instanceof ObjectNode)
			return this.getFusionPropertyCompletionsForObjectNode(context.workspace, <LinePositionedNode<ObjectNode>>context.foundNodeByLine!)
		if (foundNode instanceof ObjectPathNode)
			return this.getFusionPropertyCompletionsForObjectPath(context.workspace, <LinePositionedNode<ObjectPathNode>>context.foundNodeByLine!)

		return null
	}

	protected getObjectStatementCompletions(workspace: FusionWorkspace, parsedFile: ParsedFusionFile, foundNode: LinePositionedNode<ObjectStatement>) {
		const node = foundNode.getNode()


		const routingActionsCompletions = this.getObjectStatementRoutingActionsCompletions(workspace, parsedFile, node)
		if (routingActionsCompletions) return routingActionsCompletions

		if (node.operation !== null && node.operation.position.begin === node.operation.position.end) return []

		return this.getPropertyDefinitionSegments(node, workspace)
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
			completions.push(ElementHelper.createCompletionItem([...restObjectPathParts, label].join('.'), foundNode, CompletionItemKind.Class))
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
				const completionItem = ElementHelper.createCompletionItem(fullName, linePositionedObjectNode, CompletionItemKind.Method, newText, ElementHelper.ParameterHintsCommand)
				completionItem.detail = method.description
				completions.push(completionItem)
			}
		}

		return completions
	}

	async onHover(context: ElementTextDocumentContext<HoverParams, AbstractNode>): Promise<Hover | null | undefined> {
		const foundNode = context.foundNodeByLine!
		const node = foundNode.getNode()
		if (node instanceof PathSegment) return ElementHelper.createHover(`property **${node.identifier}**`, foundNode)

		return null
	}
}