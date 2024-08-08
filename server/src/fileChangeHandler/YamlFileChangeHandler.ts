import { FileEvent } from 'vscode-languageserver'
import { AbstractFileChangeHandler } from './AbstractFileChangeHandler'
import { LanguageServer } from '../LanguageServer'

export class YamlFileChangeHandler extends AbstractFileChangeHandler {

	protected rerunAgain: boolean = false
	protected running: boolean = false

	protected debounceTimeout: any = undefined

	constructor(languageServer: LanguageServer) {
		super(languageServer)
	}

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
		this.logInfo("|handleNodeTypeFileChanged")
		if (!this.running) {
			this.logInfo("  Ignored but will rerun again...")
			this.rerunAgain = true
			return
		}

		await this.rebuildConfiguration()
		this.logInfo("  Build configuration")
		if (this.rerunAgain) {
			this.logInfo("  will rerun")
			await this.rebuildConfiguration()
			this.rerunAgain = false
		}

		this.logInfo("  will finish")
		this.running = false
	}

	protected async rebuildConfiguration() {
		for (const fusionWorkspace of this.languageServer.fusionWorkspaces) {
			for (const neosPackage of fusionWorkspace.neosWorkspace.getPackages().values()) {
				neosPackage.readConfiguration()
			}

			fusionWorkspace.neosWorkspace.configurationManager.rebuildConfiguration()
			fusionWorkspace.languageServer.sendFlowConfiguration(fusionWorkspace.neosWorkspace.configurationManager['mergedConfiguration'])
		}

		return Promise.all(this.languageServer.fusionWorkspaces.map(workspace => workspace.diagnoseAllFusionFiles()))
	}
}