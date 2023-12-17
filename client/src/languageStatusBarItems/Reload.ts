import { AbstractLanguageStatusBarItem } from './AbstractLanguageStatusBarItem';

export class Reload extends AbstractLanguageStatusBarItem {
	public getName(): string {
		return 'reload'
	}

	constructor() {
		super()

		this.item.text = "Reload Fusion language server"
		this.item.command = {
			title: "reload",
			command: "neos-fusion-lsp.reload",
			tooltip: "Reload the Fusion Language Server"
		}
	}
}