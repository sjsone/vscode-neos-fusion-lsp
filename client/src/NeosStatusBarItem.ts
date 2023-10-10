import { EventEmitter } from "events";
import { ExtensionContext, OutputChannel, StatusBarAlignment, window } from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

class NeosStatusBarItem {
	protected contextStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 100)
	protected eventEmitter = new EventEmitter

	init({ subscriptions }: ExtensionContext, client: LanguageClient, outputChannel: OutputChannel) {
		this.contextStatusBarItem.backgroundColor = '#26224C'
		this.contextStatusBarItem.color = '#ff00ff'
		// this.contextStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 100);
		// this.contextStatusBarItem.command = selectContextCommandId;
		this.updateText("Development")
		this.contextStatusBarItem.show()
		subscriptions.push(this.contextStatusBarItem);
	}

	updateText(name: string) {
		// globe
		// milestone
		// squirrel
		// 🚧 
		this.contextStatusBarItem.text = `Neos|${name}`
	}

	addListener(eventName: string | symbol, listener: (...args: any[]) => void) {
		this.eventEmitter.addListener(eventName, listener)
	}
}

const neosStatusBarItem = new NeosStatusBarItem
export { neosStatusBarItem as NeosStatusBarItem, NeosStatusBarItem as NeosStatusBarItemClass }