import { CodeAction, CodeActionKind, CodeActionParams, Position, TextEdit } from 'vscode-languageserver'
import { LanguageServer } from '../LanguageServer'

export const addFusionNoAutoincludeNeededSemanticCommentAction = async (languageServer: LanguageServer, params: CodeActionParams) => {
	const codeActions: CodeAction[] = []

	for (const diagnostic of params.context.diagnostics) {
		if (diagnostic.data?.quickAction !== "notAutoincludeNeeded") continue

		const commentText = "// @fusion-no-autoinclude-needed"

		codeActions.push({
			title: "Add `@fusion-no-autoinclude-needed`",
			kind: CodeActionKind.QuickFix,
			diagnostics: [diagnostic],
			edit: {
				changes: {
					[params.textDocument.uri]: [TextEdit.insert(Position.create(0, 0), commentText + "\n")]
				}
			}
		})
	}

	return codeActions
}