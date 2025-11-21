import { window } from "vscode"
import { Extension } from '../Extension'
import { AbstractCommand } from './AbstractCommand'

export class RebuildWorkspacesConfigurationCommand extends AbstractCommand {
	static Identifier = 'neos-fusion-lsp.rebuildWorkspacesConfiguration'

	constructor(extension: Extension) {
		super(extension)
	}

	async callback(...args: any[]) {
		for (const client of this.extension.getClients().values()) {
			await client.sendNotification("custom/workspaces/rebuildConfiguration")
		}
		window.showInformationMessage('Configuration and everything related will be rebuild for all workspaces.')
	}
}