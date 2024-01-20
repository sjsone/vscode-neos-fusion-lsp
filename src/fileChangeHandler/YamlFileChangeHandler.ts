import { FileEvent } from 'vscode-languageserver'
import { AbstractFileChangeHandler } from './AbstractFileChangeHandler'

export class YamlFileChangeHandler extends AbstractFileChangeHandler {
	canHandleFileEvent(fileEvent: FileEvent): boolean {
		return fileEvent.uri.endsWith(".yaml") && fileEvent.uri.includes("NodeTypes")
	}

	public handleChanged(fileEvent: FileEvent) {
		return this.handleNodeTypeFileChanged()
	}

	public handleCreated(fileEvent: FileEvent) {
		return this.handleNodeTypeFileChanged()
	}

	public handleDeleted(fileEvent: FileEvent) {
		return this.handleNodeTypeFileChanged()
	}

	protected async handleNodeTypeFileChanged() {
		for (const workspace of this.languageServer.fusionWorkspaces) {
			for (const neosPackage of workspace.neosWorkspace.getPackages().values()) {
				neosPackage.readConfiguration()
			}
		}
		await Promise.all(this.languageServer.fusionWorkspaces.map(workspace => workspace.diagnoseAllFusionFiles()))
	}

}