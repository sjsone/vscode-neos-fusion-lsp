import { Extension } from '../Extension'
import { AbstractCommand } from './AbstractCommand'
import { window } from "vscode"

export class RefreshPrototypesCommand extends AbstractCommand {
	static Identifier = 'neos-fusion-lsp.refreshPrototypes'

	constructor(extension: Extension) {
		super(extension)
	}

	async callback(...args: any[]) {
		window.showInformationMessage('Prototype tree will refresh on the next file change or language server restart.')
	}
}