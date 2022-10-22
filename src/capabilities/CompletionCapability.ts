import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment';
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment';
import { CompletionItemKind, TextDocumentPositionParams } from 'vscode-languageserver/node';
import { FusionWorkspace } from '../fusion/FusionWorkspace';
import { ParsedFusionFile } from '../fusion/ParsedFusionFile';
import { AbstractCapability } from './AbstractCapability';

export class CompletionCapability extends AbstractCapability {
	public run(textDocumentPosition: TextDocumentPositionParams) {
		const fusionWorkspace = this.languageServer.getWorspaceFromFileUri(textDocumentPosition.textDocument.uri);
		if (fusionWorkspace === undefined) return [];

		const completions = [];

		completions.push(...this.getPrototypeCompletions(fusionWorkspace));

		const parsedFile = fusionWorkspace.getParsedFileByUri(textDocumentPosition.textDocument.uri);
		if (parsedFile) completions.push(...this.getFusionPropertyCompletions(parsedFile));

		this.logVerbose(`Found ${completions.length} completions `);

		return completions;
	}

	protected getFusionPropertyCompletions(parsedFile: ParsedFusionFile) {
		const completions = [];

		const foundNodes = parsedFile.getNodesByType(PathSegment);
		if (!foundNodes) return null;

		for (const fileNode of foundNodes) {
			const label = fileNode.getNode().identifier;
			if (!completions.find(completion => completion.label === label)) {
				completions.push({
					label,
					kind: CompletionItemKind.Field
				});
			}
		}

		return completions;
	}

	protected getPrototypeCompletions(workspace: FusionWorkspace) {
		const completions = [];

		const foundNodes = workspace.getNodesByType(PrototypePathSegment);
		if (!foundNodes) return null;

		for (const fileNodes of foundNodes) {
			for (const fileNode of fileNodes.nodes) {
				const label = fileNode.getNode().identifier;
				if (!completions.find(completion => completion.label === label)) {
					completions.push({
						label,
						kind: CompletionItemKind.Class
					});
				}
			}
		}

		return completions;
	}
}