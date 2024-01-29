import { Uri, workspace as Workspace, WorkspaceFolder } from 'vscode'
import { AbstractCommand } from './AbstractCommand'

export class ReloadCommand extends AbstractCommand {
	static Identifier = "neos-fusion-lsp.reload"

	public async callback() {
		const uris = Array.from(this.extension.getClients().keys())

		await this.extension.stopClients()

		for (const uri of uris) {
			const folder = Workspace.getWorkspaceFolder(Uri.file(uri.replace("file://", "")))
			if (!folder) continue

			const outerMostWorkspaceFolder = this.extension.getOuterMostWorkspaceFolder(folder)
			this.startClient(outerMostWorkspaceFolder)
		}
	}

	protected startClient(workspaceFolder: WorkspaceFolder) {
		this.extension.startClient(workspaceFolder)
	}

}