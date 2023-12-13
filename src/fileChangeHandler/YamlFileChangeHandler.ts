import { FileEvent } from 'vscode-languageserver';
import { AbstractFileChangeHandler } from './AbstractFileChangeHandler';

export class YamlFileChangeHandler extends AbstractFileChangeHandler {
	canHandleFileEvent(fileEvent: FileEvent): boolean {
		// TODO: check if yaml file is relevant (FlowConfiguration.responsibleFor(fileEvent.uri) ?)
		return fileEvent.uri.endsWith(".yaml")
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
		for (const fusionWorkspace of this.languageServer["fusionWorkspaces"]) {
			for (const neosPackage of fusionWorkspace.neosWorkspace.getPackages().values()) {
				neosPackage.readConfiguration()
			}

			fusionWorkspace.neosWorkspace.configurationManager.rebuildConfiguration()
			fusionWorkspace.languageServer.sendFlowConfiguration(fusionWorkspace.neosWorkspace.configurationManager['mergedConfiguration'])
		}
		await Promise.all(this.languageServer["fusionWorkspaces"].map(workspace => workspace.diagnoseAllFusionFiles()))
	}
}