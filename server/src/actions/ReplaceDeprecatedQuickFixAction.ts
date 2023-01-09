import { CodeAction, DiagnosticTag, CodeActionKind, CodeActionParams } from 'vscode-languageserver';

export function replaceDeprecatedQuickFixAction(params: CodeActionParams) {
	const codeActions: CodeAction[] = [];

	for (const diagnostic of params.context.diagnostics) {
		if (!diagnostic.tags?.includes(DiagnosticTag.Deprecated)) continue

		const newText = diagnostic.data?.newName
		if (!newText) continue

		codeActions.push({
			title: "Replace deprecated",
			kind: CodeActionKind.QuickFix,
			diagnostics: [diagnostic],
			edit: {
				changes: {
					[params.textDocument.uri]: [{
						range: diagnostic.range, newText
					}]
				}
			}
		})
	}

	return codeActions
}