import * as NodeFs from 'fs'

import { CodeAction, CodeActionKind, CodeActionParams, Range, TextEdit } from 'vscode-languageserver';
import { getLinesFromLineDataCacheForFile, hasLineDataCacheFile, setLinesFromLineDataCacheForFile, uriToPath } from '../common/util';
import { LanguageServer } from '../LanguageServer';

async function getLinesFromUri(uri: string) {
	const document = (await NodeFs.promises.readFile(uriToPath(uri))).toString()
	return document.split("\n")
}

// TODO: implement central SemanticComment handling (Service etc.)
export const addFusionIgnoreSemanticCommentAction = async (languageServer: LanguageServer, params: CodeActionParams) => {
	const uri = params.textDocument.uri
	const codeActions: CodeAction[] = [];

	for (const diagnostic of params.context.diagnostics) {
		if (diagnostic.data?.quickAction !== "ignorable") continue

		if (!hasLineDataCacheFile(uri)) setLinesFromLineDataCacheForFile(uri, await getLinesFromUri(uri))
		const entry = getLinesFromLineDataCacheForFile(uri)

		const affectedNodeRange: Range = diagnostic.data?.affectedNodeRange ?? diagnostic.range
		const lineIndent = entry.lineIndents[affectedNodeRange.start.line]

		const insertPosition = {
			line: affectedNodeRange.start.line - 1,
			character: entry.lineLengths[affectedNodeRange.start.line - 1] + 1
		}

		const commentText = diagnostic.data?.commentType === "afx" ? "<!-- @fusion-ignore -->" : "// @fusion-ignore"

		codeActions.push({
			title: "Add `@fusion-ignore`",
			kind: CodeActionKind.QuickFix,
			diagnostics: [diagnostic],
			edit: {
				changes: {
					[params.textDocument.uri]: [TextEdit.insert(insertPosition, "\n" + lineIndent + commentText)]
				}
			}
		})
	}

	return codeActions
}