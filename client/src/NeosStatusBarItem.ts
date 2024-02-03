import { EventEmitter } from "events"
import { ExtensionContext, OutputChannel, QuickPickItem, QuickPickItemKind, StatusBarAlignment, commands, window } from 'vscode'
import { LanguageClient } from 'vscode-languageclient/node'

class NeosStatusBarItem {
	static readonly ChangedContextEvent = "changed_context"
	protected selectedContextName!: string
	protected statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 100)
	protected eventEmitter = new EventEmitter

	init({ subscriptions }: ExtensionContext, client: LanguageClient, outputChannel: OutputChannel) {
		this.statusBarItem.backgroundColor = '#26224C'
		this.statusBarItem.color = '#00ADEE'
		this.updateText("Development")

		const showStatusBarActionsQuickPickCommandId = 'fusion-lsp.showStatusBarActionsQuickPick'
		subscriptions.push(commands.registerCommand(showStatusBarActionsQuickPickCommandId, async () => {
			const reloadQuickPickItem = {
				label: "$(search-refresh) Reload",
				detail: "...because have you tried turning it off and on again?",
				description: "language server",
			}

			const setConfigurationContextQuickPickItem = {
				label: "$(search-show-context) 🧪-Experimental-🧪  Set Context",
				detail: "This sets the configuration context used for language server features",
			}

			const quickPick = window.createQuickPick()
			quickPick.title = "NEOS Fusion language server actions"
			quickPick.items = [
				{
					label: "Language Server",
					kind: QuickPickItemKind.Separator
				},
				reloadQuickPickItem,
				{
					label: "Flow Configuration",
					kind: QuickPickItemKind.Separator
				},
				setConfigurationContextQuickPickItem
			]
			quickPick.onDidChangeSelection(selections => {
				quickPick.hide()

				const selection = selections[0]
				if (!selection) return

				if (selection === reloadQuickPickItem) {
					commands.executeCommand("neos-fusion-lsp.reload")
				}

				if (selection === setConfigurationContextQuickPickItem) {
					this.handleSetConfiguration(client)
				}
			})
			quickPick.onDidHide(() => quickPick.dispose())
			quickPick.show()
		}))

		this.statusBarItem.command = showStatusBarActionsQuickPickCommandId

		this.statusBarItem.show()
		subscriptions.push(this.statusBarItem)
	}

	protected async handleSetConfiguration(client: LanguageClient) {
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
	}

	updateText(name: string) {
		this.selectedContextName = name
		this.eventEmitter.emit(NeosStatusBarItem.ChangedContextEvent, this.selectedContextName)
		// globe, milestone, squirrel, 🚧 
		// this.statusBarItem.text = `$(neos-lsp)|${name}`
		this.statusBarItem.text = `$(neos-lsp)EOS|${name}`
	}

	addListener(eventName: string | symbol, listener: (...args: any[]) => void) {
		this.eventEmitter.addListener(eventName, listener)
	}
}

const neosStatusBarItem = new NeosStatusBarItem
export { neosStatusBarItem as NeosStatusBarItem, NeosStatusBarItem as NeosStatusBarItemClass }
