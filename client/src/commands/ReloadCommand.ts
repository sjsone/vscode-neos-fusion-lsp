import { Uri, workspace as Workspace, WorkspaceFolder } from 'vscode'
import { AbstractCommand } from './AbstractCommand'

export class ReloadCommand extends AbstractCommand {
	static readonly Identifier: string = "neos-fusion-lsp.reload"

	public async callback() {
		const uris = Array.from(this.extension.getClients().keys())

		await this.extension.stopClients()

		for (const uri of uris) {
			try {
				const filePath = uri.replace(/^file:\/\//, '')
				const folder = Workspace.getWorkspaceFolder(Uri.file(filePath))
				if (!folder) continue

				const outerMostWorkspaceFolder = this.extension.getOuterMostWorkspaceFolder(folder)
				this.startClient(outerMostWorkspaceFolder)
			} catch (error) {
				console.error(`Failed to reload client for uri: ${uri}`, error)
			}
		}
	}

	protected startClient(workspaceFolder: WorkspaceFolder) {
		this.extension.startClient(workspaceFolder)
	}

}