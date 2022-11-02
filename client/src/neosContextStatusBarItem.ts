import EventEmitter = require('events');
import { commands, ExtensionContext, OutputChannel, QuickPickItem, QuickPickItemKind, StatusBarAlignment, window } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

class NeosContextStatusBarItem {
	static ChangedContextEvent = "changedcontext"
	protected selectedContextName: string
	protected contextStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100)
	protected eventEmitter = new EventEmitter

	init({ subscriptions }: ExtensionContext, client: LanguageClient, outputChannel: OutputChannel) {
		const selectContextCommandId = 'fusion-lsp.selectContext';
		subscriptions.push(commands.registerCommand(selectContextCommandId, async () => {
			const result: string[] = await client.sendRequest("custom/neosContexts/get")
			const options: QuickPickItem[] = result.map(label => ({ label }))

			const quickPick = window.createQuickPick();
			quickPick.title = "Set FLOW_CONTEXT"
			quickPick.items = options
			quickPick.onDidChangeSelection(selection => {
				this.updateText(selection[0].label)
				// window.showInformationMessage(`Yeah, ${JSON.stringify(selection[0].label)}`);
				quickPick.hide()
			});
			quickPick.onDidHide(() => quickPick.dispose());
			quickPick.show();
		}));

		this.contextStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
		this.contextStatusBarItem.command = selectContextCommandId;
		this.updateText("Development")
		this.contextStatusBarItem.show()
		subscriptions.push(this.contextStatusBarItem);
	}

	updateText(name: string) {
		this.selectedContextName = name
		this.eventEmitter.emit(NeosContextStatusBarItem.ChangedContextEvent, this.selectedContextName)
		this.contextStatusBarItem.text = `Context: ${this.selectedContextName}`
	}
}
const neosContextStatusBarItem = new NeosContextStatusBarItem
export { neosContextStatusBarItem as NeosContextStatusBarItem, NeosContextStatusBarItem as NeosContextStatusBarItemClass }