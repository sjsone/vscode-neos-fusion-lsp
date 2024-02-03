import { WorkspaceFolder } from 'vscode'
import { ReloadCommand } from './ReloadCommand'

export class InspectCommand extends ReloadCommand {
	static readonly Identifier = "neos-fusion-lsp.inspect"

	protected startClient(workspaceFolder: WorkspaceFolder): void {
		this.extension.startClient(workspaceFolder, true)
	}
}