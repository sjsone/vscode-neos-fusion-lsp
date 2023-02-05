import { Uri, workspace as Workspace } from 'vscode';
import { Extension } from '../Extension';
import { AbstractCommand } from './AbstractCommand';

export class InspectCommand extends AbstractCommand {
	static Identifier = "neos-fusion-lsp.inspect"

	public async callback(name: string = 'world') {
		const uris = Array.from(this.extension.getClients().keys())

		await this.extension.stopClients()

		for (const uri of uris) {
			const folder = Workspace.getWorkspaceFolder(Uri.file(uri.replace("file://", "")))
			if (!folder) continue

			const outerMostWorkspaceFolder = this.extension.getOuterMostWorkspaceFolder(folder)
			this.extension.startClient(outerMostWorkspaceFolder, true)
		}
	}

}