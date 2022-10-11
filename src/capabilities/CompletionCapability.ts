import { PrototypePathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PrototypePathSegment';
import { CompletionItemKind, TextDocumentPositionParams } from 'vscode-languageserver/node';
import { AbstractCapability } from './AbstractCapability';

export class CompletionCapability extends AbstractCapability {
	public run(textDocumentPosition: TextDocumentPositionParams) {

		const fusionWorkspace = this.languageServer.getWorspaceFromFileUri(textDocumentPosition.textDocument.uri)
		if (fusionWorkspace === undefined) return []
		const foundNodes = fusionWorkspace.getNodesByType(PrototypePathSegment)

		return foundNodes.reduce((prev, cur) => {
			const completions = cur.nodes.map(node => ({
				label: node.getNode().identifier,
				kind: CompletionItemKind.Keyword
			}))
			prev.push(...completions)
			return prev
		}, [])
	}
}