import { ObjectNode } from 'ts-fusion-parser/out/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/eel/nodes/ObjectPathNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue'
import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment'
import { CompletionItem, CompletionItemKind, InsertReplaceEdit, InsertTextMode, Position, TextDocumentPositionParams } from 'vscode-languageserver/node'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { LinePositionedNode } from '../LinePositionedNode'
import { AbstractCapability } from './AbstractCapability'

export class CompletionCapability extends AbstractCapability {
	public run(textDocumentPosition: TextDocumentPositionParams) {
		const fusionWorkspace = this.languageServer.getWorspaceFromFileUri(textDocumentPosition.textDocument.uri)
		if (fusionWorkspace === undefined) return []

		const parsedFile = fusionWorkspace.getParsedFileByUri(textDocumentPosition.textDocument.uri)
		if (!parsedFile) return null

		const completions = [...this.getFusionPropertyCompletions(parsedFile)]
		const foundLinePositionedNode = parsedFile.getNodeByLineAndColumn(textDocumentPosition.position.line + 1, textDocumentPosition.position.character + 1)

		if (foundLinePositionedNode) {
			const foundNode = foundLinePositionedNode.getNode()
			switch (true) {
				case foundNode instanceof FusionObjectValue:
				case foundNode instanceof PrototypePathSegment:
					completions.push(...this.getPrototypeCompletions(fusionWorkspace, foundLinePositionedNode))
					break;
				case foundNode instanceof ObjectPathNode:
					completions.push(...this.getObjectPathNodeCompletions(fusionWorkspace, foundLinePositionedNode))
					break;
			}
		}

		this.logVerbose(`Found ${completions.length} completions `)

		return completions
	}

	protected getFusionPropertyCompletions(parsedFile: ParsedFusionFile): CompletionItem[] {
		const completions = []

		const foundNodes = parsedFile.getNodesByType(PathSegment)
		if (!foundNodes) return null

		for (const fileNode of foundNodes) {
			const label = fileNode.getNode().identifier
			if (!completions.find(completion => completion.label === label)) {
				completions.push({
					label,
					kind: CompletionItemKind.Field
				})
			}
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
						insertTextMode: InsertTextMode.asIs,
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

	protected getObjectPathNodeCompletions(fusionWorkspace: FusionWorkspace, foundNode: LinePositionedNode<any>): CompletionItem[] {
		const node = <ObjectPathNode>foundNode.getNode()
		const objectNode = <ObjectNode>node["parent"]
		const linePositionedObjectNode = objectNode["linePositionedNode"]
		const fullPath = objectNode["path"].map(part => part["value"]).join(".")
		const completions: CompletionItem[] = []

		const eelHelpers = fusionWorkspace.neosWorkspace.getEelHelperTokens()
		for(const eelHelper of eelHelpers) {
			for(const method of eelHelper.methods) {
				const fullName = eelHelper.name + "." + method.name
				if(!fullName.startsWith(fullPath)) continue
				
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