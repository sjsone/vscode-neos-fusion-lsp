import { FileChangeType, FileEvent } from 'vscode-languageserver'
import { AbstractFileChangeHandler } from './AbstractFileChangeHandler'
import { uriToPath } from '../common/util'

export class FusionFileChangeHandler extends AbstractFileChangeHandler {
	canHandleFileEvent(fileEvent: FileEvent): boolean {
		return fileEvent.type !== FileChangeType.Changed && fileEvent.uri.endsWith(".fusion")
	}

	public async handleCreated(fileEvent: FileEvent) {
		const workspace = this.languageServer.getWorkspaceForFileUri(fileEvent.uri)
		if (!workspace) {
			this.logInfo(`Created Fusion file corresponds to no workspace. ${fileEvent.uri}`)
			return
		}

		const neosPackage = workspace.neosWorkspace.getPackageByUri(fileEvent.uri)
		if (!neosPackage) return

		workspace.addParsedFileFromPath(uriToPath(fileEvent.uri), neosPackage)
		this.logDebug(`Added new ParsedFusionFile ${fileEvent.uri}`)
	}

	public async handleChanged(fileEvent: FileEvent) {
		throw new Error('Method not implemented.')
	}

	public async handleDeleted(fileEvent: FileEvent): Promise<void> {
		await super.handleDeleted(fileEvent)
		const workspace = this.languageServer.getWorkspaceForFileUri(fileEvent.uri)
		if (!workspace) {
			this.logInfo(`Deleted Fusion file corresponds to no workspace. ${fileEvent.uri}`)
			return
		}
		workspace.removeParsedFile(fileEvent.uri)
	}
}