import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue'
import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment'
import { CompletionItem, CompletionItemKind, InsertTextMode, TextDocumentPositionParams } from 'vscode-languageserver/node'
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
						range: {
							start: { line: foundNode.getBegin().line - 1, character: foundNode.getBegin().column - 1 },
							end: { line: foundNode.getBegin().line - 1, character: foundNode.getBegin().column + label.length - 1 },
						},
						newText: label
					})
				}
			}
		}

		return completions
	}
}