import { PrototypePathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PrototypePathSegment';
import { CompletionItemKind, TextDocumentPositionParams } from 'vscode-languageserver/node';
import { AbstractCapability } from './AbstractCapability';

export class CompletionCapability extends AbstractCapability {
	public run(textDocumentPosition: TextDocumentPositionParams) {

		const fusionWorkspace = this.languageServer.getWorspaceFromFileUri(textDocumentPosition.textDocument.uri)
		if (fusionWorkspace === undefined) return []
		const foundNodes = fusionWorkspace.getNodesByType(PrototypePathSegment)

		const completions = []
		
		for (const fileNodes of foundNodes) {
			for(const fileNode of fileNodes.nodes) {
				const label = fileNode.getNode().identifier
				if(!completions.find(completion => completion.label === label)) {
					completions.push({
						label,
						kind: CompletionItemKind.Class
					})
				}
			}
		}

		return completions
	}
}