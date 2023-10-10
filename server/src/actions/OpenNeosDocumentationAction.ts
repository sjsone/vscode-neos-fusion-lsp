import { CodeAction, CodeActionKind, CodeActionParams } from 'vscode-languageserver';
import { LanguageServer } from '../LanguageServer';

export function openNeosDocumentationAction(languageServer: LanguageServer, params: CodeActionParams) {
	const codeActions: CodeAction[] = [];

	for (const diagnostic of params.context.diagnostics) {
		if (!diagnostic.data?.openDocumentation) continue

		codeActions.push({
			title: "Open Documentation",
			kind: CodeActionKind.QuickFix,
			diagnostics: [diagnostic],
			isPreferred: true,
			command: {
				title: "NodeType Definition",
				command: 'neos-fusion-lsp.showNeosDocumentationView',
				arguments: [

				]
			}
		})
	}

	return codeActions
}