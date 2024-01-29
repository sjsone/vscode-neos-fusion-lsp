import { CodeAction, CodeActionKind, CodeActionParams, Command } from 'vscode-languageserver'
import { LanguageServer } from '../LanguageServer'

export const openDocumentationAction = (languageServer: LanguageServer, params: CodeActionParams) => {
	const codeActions: CodeAction[] = []

	for (const diagnostic of params.context.diagnostics) {
		if (diagnostic.data?.documentation?.uri === undefined) continue

		if (diagnostic.data.documentation?.openInBrowser) codeActions.push({
			title: "Open Documentation in Browser",
			kind: CodeActionKind.QuickFix,
			command: Command.create("Open", "vscode.open", diagnostic.data.documentation.uri),
		})
	}

	return codeActions
}