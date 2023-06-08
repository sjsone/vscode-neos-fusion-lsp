import { CodeAction, CodeActionKind, CodeActionParams, CodeActionTriggerKind, Command, Position, TextEdit } from 'vscode-languageserver';
import { LanguageServer } from '../LanguageServer';
import { getLinesFromLineDataCacheForFile, hasLineDataCacheFile, setLinesFromLineDataCacheForFile } from '../common/util';

export const extractAfxToOwnComponentAction = (languageServer: LanguageServer, params: CodeActionParams) => {
	if (params.context.triggerKind !== CodeActionTriggerKind.Invoked) return []
	if (!params.context.only?.includes(CodeActionKind.RefactorExtract)) return []

	console.log("extractAfxToOwnComponentAction", params)

	const workspace = languageServer.getWorkspaceForFileUri(params.textDocument.uri)
	if (!workspace) return []

	const fusionFile = workspace.getParsedFileByUri(params.textDocument.uri)
	if (!fusionFile) return []

	const nodesByRange = fusionFile.getNodesByRange(params.range.start, params.range.end)
	console.log("nodesByRange", nodesByRange)

	const cutRange = {
		start: Position.create(Infinity, Infinity),
		end: Position.create(-Infinity, -Infinity)
	}

	const cutOffsets = {
		begin: Infinity,
		end: -Infinity
	}

	for (const node of nodesByRange) {
		if (node.linePositionedNode.getBegin().line <= cutRange.start.line) {
			cutRange.start.line = node.linePositionedNode.getBegin().line
			if (node.linePositionedNode.getBegin().character <= cutRange.start.character) {
				cutRange.start.character = node.linePositionedNode.getBegin().character
			}
		}
		if (node.linePositionedNode.getEnd().line >= cutRange.end.line) {
			cutRange.end.line = node.linePositionedNode.getEnd().line
			if (node.linePositionedNode.getEnd().character >= cutRange.end.character) {
				cutRange.end.character = node.linePositionedNode.getEnd().character
			}
		}

		if (node["position"].begin <= cutOffsets.begin) cutOffsets.begin = node["position"].begin
		if (node["position"].end >= cutOffsets.end) cutOffsets.end = node["position"].end
	}

	console.log("cutRange", cutRange)
	console.log("cutOffsets", cutOffsets)
	const fileText = fusionFile.readTextFromFile()
	console.log("data: ", fileText.slice(cutOffsets.begin, cutOffsets.end))


	if (!hasLineDataCacheFile(fusionFile.uri)) setLinesFromLineDataCacheForFile(fusionFile.uri, fileText.split("\n"))
	const lines = getLinesFromLineDataCacheForFile(fusionFile.uri)

	const lastLineLength = lines.lineLengths.at(-1)
	const lastPosition = Position.create(lines.lineLengths.length-1, lastLineLength)


	const newText = [
		``,
		`prototype(REPLACE) < prototype(Neos.Fusion:Component) {`,
		`    renderer = afx\``,
		`${fileText.slice(cutOffsets.begin, cutOffsets.end)}`,
		`    \``,
		`}`
	]


	const codeActions: CodeAction[] = [];
	const codeAction = CodeAction.create("test", CodeActionKind.QuickFix)
	codeAction.edit = {
		documentChanges: [
			{
				textDocument: {
					version: 0,
					uri: params.textDocument.uri
				},
				edits: [
					TextEdit.del(cutRange),
					TextEdit.insert(lastPosition, newText.join("\n"))
				]
			}
		]
	}
	codeActions.push(codeAction)
	return codeActions
}