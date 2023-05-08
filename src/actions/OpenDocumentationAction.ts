import { CodeActionParams, CodeAction, CodeActionKind } from 'vscode-languageserver';

export function openDocumentationAction(params: CodeActionParams) {
	const codeActions: CodeAction[] = [];

	for (const diagnostic of params.context.diagnostics) {
		if (diagnostic.data?.documentation.uri === undefined) continue

		if (diagnostic.data.documentation.openInBrowser) codeActions.push({
			title: "Open Documentation in Browser",
			kind: CodeActionKind.QuickFix,
			command: {
				title: "Open",
				command: "vscode.open",
				arguments: [diagnostic.data.documentation.uri],
			}
		})
	}

	return codeActions
}