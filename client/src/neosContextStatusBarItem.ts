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
			const results: { context: string, selected: boolean }[] = await client.sendRequest("custom/neosContexts/get")

			const options: QuickPickItem[] = []
			for (const result of results) {
				const option: QuickPickItem = {
					label: result.context,
					picked: result.selected
				}
				if (result.selected) {
					options.unshift({
						label: "",
						kind: QuickPickItemKind.Separator
					})
					options.unshift(option)
				} else {
					options.push(option)
				}
			}

			const quickPick = window.createQuickPick()
			quickPick.title = "Set FLOW_CONTEXT"
			quickPick.items = options
			quickPick.selectedItems = options.filter(option => option.picked)
			quickPick.onDidChangeSelection(selection => {
				this.updateText(selection[0].label)
				quickPick.hide()
			})
			quickPick.onDidHide(() => quickPick.dispose())
			quickPick.show()
		}))

		this.contextStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
		this.contextStatusBarItem.command = selectContextCommandId;
		this.updateText("Development")
		this.contextStatusBarItem.show()
		subscriptions.push(this.contextStatusBarItem);
	}

	updateText(name: string) {
		this.selectedContextName = name
		this.eventEmitter.emit(NeosContextStatusBarItem.ChangedContextEvent, this.selectedContextName)
		// globe
		// milestone
		// squirrel
		// 🚧 
		this.contextStatusBarItem.text = `🚧 Flow Context: ${this.selectedContextName}`
	}

	addListener(eventName: string | symbol, listener: (...args: any[]) => void) {
		this.eventEmitter.addListener(eventName, listener)
	}
}
const neosContextStatusBarItem = new NeosContextStatusBarItem
export { neosContextStatusBarItem as NeosContextStatusBarItem, NeosContextStatusBarItem as NeosContextStatusBarItemClass }