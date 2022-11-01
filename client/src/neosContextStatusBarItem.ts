import { commands, ExtensionContext, OutputChannel, QuickPickItem, QuickPickItemKind, StatusBarAlignment, window } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

class NeosContextStatusBarItem {
	init({ subscriptions }: ExtensionContext, client: LanguageClient, outputChannel: OutputChannel) {
		const selectContextCommandId = 'fusion-lsp.selectContext';
		subscriptions.push(commands.registerCommand(selectContextCommandId, async () => {
			const result: string[] = await client.sendRequest("custom/neosContexts/get")

			const options: QuickPickItem[] = result.map(label => ({ label }))
			const quickPick = window.createQuickPick();
			quickPick.title = "Set FLOW_CONTEXT"
			quickPick.items = options
			quickPick.onDidChangeSelection(selection => {
				window.showInformationMessage(`Yeah, ${JSON.stringify(selection)}`);
			});
			quickPick.onDidHide(() => quickPick.dispose());
			quickPick.show();
		}));

		const contextStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
		contextStatusBarItem.command = selectContextCommandId;
		contextStatusBarItem.text = "Context: "
		contextStatusBarItem.show()
		subscriptions.push(contextStatusBarItem);
	}
}
const neosContextStatusBarItem = new NeosContextStatusBarItem
export { neosContextStatusBarItem as NeosContextStatusBarItem, NeosContextStatusBarItem as NeosContextStatusBarItemClass }