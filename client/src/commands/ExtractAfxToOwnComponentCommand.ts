import * as NodeUtils from 'util';
import { TextDocument, window, CodeActionKind, CodeAction } from 'vscode';
import { CodeActionTriggerKind, Event } from 'vscode-languageclient';
import { AbstractCommand } from './AbstractCommand';
import { workspace } from 'vscode';
export class ExtractAfxToOwnComponentCommand extends AbstractCommand {
	static Identifier = "neos-fusion-lsp.code.extractAfxToOwnComponent"

	public async callback(file: TextDocument, ...args: any[]): Promise<any> {
		const outputChannel = this.extension["outputChannel"]
		const selection = window.activeTextEditor.selection

		const client = Array.from(this.extension["clients"].values())[0]
		const request = client["getFeature"]("textDocument/codeAction")
		const provider = request.getProvider(window.activeTextEditor.document)
		const codeActionResults = await provider.provideCodeActions(
			window.activeTextEditor.document,
			selection,
			{
				diagnostics: [],
				only: CodeActionKind.RefactorExtract,
				triggerKind: CodeActionTriggerKind.Invoked
			},
			{ isCancellationRequested: false, onCancellationRequested: Event.None }
		)

		outputChannel.appendLine("codeActionResults, " + NodeUtils.inspect(codeActionResults))

		for (const codeActionResult of codeActionResults) {
			if(!("edit" in codeActionResult)) continue

			const workspaceEdit = codeActionResult.edit
			outputChannel.appendLine("workspaceEdit, " + NodeUtils.inspect(workspaceEdit))

			workspace.applyEdit(workspaceEdit)

			// if (workspaceEdit.documentChanges) {
			// 	for (const change of workspaceEdit.documentChanges) {
			// 		if (vscode_languageserver_protocol_1.TextDocumentEdit.is(change)



			// const applyResult = await client["handleApplyWorkspaceEdit"](codeActionResult)
			// outputChannel.appendLine("applyResult, " + NodeUtils.inspect(applyResult))

		}

		outputChannel.appendLine("window.activeTextEditor.selection, " + NodeUtils.inspect(window.activeTextEditor.selection))
		outputChannel.appendLine("ExtractAfxToOwnComponentCommand, " + NodeUtils.inspect(args))
	}
}