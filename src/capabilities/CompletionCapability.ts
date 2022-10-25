import { ObjectNode } from 'ts-fusion-parser/out/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/eel/nodes/ObjectPathNode'
import { AbstractNode } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/AbstractNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue'
import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment'
import { CompletionItem, CompletionItemKind, InsertReplaceEdit, InsertTextMode } from 'vscode-languageserver/node'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { LinePositionedNode } from '../LinePositionedNode'
import { NodeService } from '../NodeService'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext } from './CapabilityContext'

export class CompletionCapability extends AbstractCapability {

	protected run(context: CapabilityContext<AbstractNode>) {
		const { workspace, parsedFile, foundNodeByLine } = context
		const completions = []
		if (foundNodeByLine) {
			const foundNode = foundNodeByLine.getNode()
			switch (true) {
				case foundNode instanceof FusionObjectValue:
				case foundNode instanceof PrototypePathSegment:
					completions.push(...this.getPrototypeCompletions(workspace, <any>foundNodeByLine))
					break;
				case foundNode instanceof ObjectPathNode:
					completions.push(...this.getEelHelperCompletions(workspace, foundNodeByLine))
					completions.push(...this.getFusionPropertyCompletions(parsedFile, foundNodeByLine))
					break;
			}
		}

		this.logVerbose(`Found ${completions.length} completions `)

		return completions
	}

	protected getFusionPropertyCompletions(parsedFile: ParsedFusionFile, foundNode: LinePositionedNode<any>): CompletionItem[] {
		const completions = []
		console.log("foundNode", foundNode.constructor.name)

		const node = <ObjectPathNode>foundNode.getNode()
		const objectNode = <ObjectNode>node["parent"]
		if (!(objectNode instanceof ObjectNode)) return null

		if ((objectNode.path[0]["value"] !== "this" && objectNode.path[0]["value"] !== "props") || objectNode.path.length === 1) {
			// TODO: handle context properties
			return completions
		}

		for (const segment of NodeService.findPropertyDefinitionSegments(objectNode)) {
			if (!(segment instanceof PathSegment)) continue
			if (segment.identifier === "renderer" || !segment.identifier) continue
			if (completions.find(completion => completion.label === segment.identifier)) continue
			completions.push({
				label: segment.identifier,
				kind: CompletionItemKind.Property
			})
		}

		return completions
	}

	protected getPrototypeCompletions(fusionWorkspace: FusionWorkspace, foundNode: LinePositionedNode<FusionObjectValue | PrototypePathSegment>): CompletionItem[] {
		const completions = []

		const foundNodes = fusionWorkspace.getNodesByType(PrototypePathSegment)
		if (!foundNodes) return null

		for (const fileNodes of foundNodes) {
			for (const fileNode of fileNodes.nodes) {
				const label = fileNode.getNode().identifier
				if (!completions.find(completion => completion.label === label)) {
					completions.push({
						label,
						kind: CompletionItemKind.Class,
						insertTextMode: InsertTextMode.adjustIndentation,
						insertText: label,
						textEdit: {
							range: {
								start: { line: foundNode.getBegin().line - 1, character: foundNode.getBegin().column - 1 },
								end: { line: foundNode.getBegin().line - 1, character: foundNode.getBegin().column + label.length - 1 },
							},
							newText: label
						}
					})
				}
			}
		}

		return completions
	}

	protected getEelHelperCompletions(fusionWorkspace: FusionWorkspace, foundNode: LinePositionedNode<any>): CompletionItem[] {
		const node = <ObjectPathNode>foundNode.getNode()
		const objectNode = <ObjectNode>node["parent"]
		const linePositionedObjectNode = objectNode["linePositionedNode"]
		const fullPath = objectNode["path"].map(part => part["value"]).join(".")
		const completions: CompletionItem[] = []

		const eelHelpers = fusionWorkspace.neosWorkspace.getEelHelperTokens()
		for (const eelHelper of eelHelpers) {
			for (const method of eelHelper.methods) {
				const fullName = eelHelper.name + "." + method.name
				if (!fullName.startsWith(fullPath)) continue

				const label = fullName
				const insertReplaceEdit: InsertReplaceEdit = {
					insert: linePositionedObjectNode.getPositionAsRange(),
					replace: {
						start: { line: linePositionedObjectNode.getBegin().line - 1, character: linePositionedObjectNode.getBegin().column - 1 },
						end: { line: linePositionedObjectNode.getEnd().line - 1, character: linePositionedObjectNode.getEnd().column + label.length - 1 },
					},
					newText: label
				}

				completions.push({
					label,
					kind: CompletionItemKind.Method,
					insertTextMode: InsertTextMode.adjustIndentation,
					insertText: label,
					textEdit: insertReplaceEdit
				})
			}
		}

		return completions
	}
}