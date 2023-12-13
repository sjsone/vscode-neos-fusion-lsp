import * as vscode from 'vscode';
import { AbstractCommand } from './AbstractCommand';

export class PutContentIntoClipboard extends AbstractCommand {
	static Identifier = "neos-fusion-lsp.putContentIntoClipboard"

	public callback(text: string): Promise<any> {
		vscode.window.setStatusBarMessage(`Copied "${text}"`, 3500)
		return Promise.resolve(vscode.env.clipboard.writeText(text))
	}
}