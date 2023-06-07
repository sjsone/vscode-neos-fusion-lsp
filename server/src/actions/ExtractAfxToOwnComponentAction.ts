import { CodeAction, CodeActionKind, CodeActionParams, CodeActionTriggerKind, Command, Position } from 'vscode-languageserver';
import { LanguageServer } from '../LanguageServer';

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
		start: Position.create(Infinity,Infinity),
		end: Position.create(-Infinity,-Infinity)
	}

	for(const node of nodesByRange) {
		if(node.linePositionedNode.getBegin().line <= cutRange.start.line) {
			cutRange.start.line = node.linePositionedNode.getBegin().line
			if(node.linePositionedNode.getBegin().character <= cutRange.start.character) {
				cutRange.start.character = node.linePositionedNode.getBegin().character
			}
		}
		if(node.linePositionedNode.getEnd().line >= cutRange.end.line) {
			cutRange.end.line = node.linePositionedNode.getEnd().line
			if(node.linePositionedNode.getEnd().character >= cutRange.end.character) {
				cutRange.end.character = node.linePositionedNode.getEnd().character
			}
		}
	}

	console.log("cutRange", cutRange)


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
					{
						range: cutRange,
						newText: ""
					}
				]
			}
		]
	}
	codeActions.push(codeAction)
	return codeActions
}