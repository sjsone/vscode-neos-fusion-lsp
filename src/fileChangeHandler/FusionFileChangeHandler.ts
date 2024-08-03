import { FileChangeType, FileEvent } from 'vscode-languageserver'
import { uriToPath } from '../common/util'
import { AbstractFileChangeHandler } from './AbstractFileChangeHandler'

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

		workspace.initPackageRootFusionFiles(neosPackage)

		workspace.addParsedFileFromPath(uriToPath(fileEvent.uri), neosPackage)
		workspace.buildMergedArrayTree("FusionFileChangeHandler created")
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

		const filePath = uriToPath(fileEvent.uri)
		const neosPackage = workspace.neosWorkspace.getPackageByUri(fileEvent.uri)
		if (neosPackage) {
			const rootFusionPaths = workspace.fusionParser.rootFusionPaths.get(neosPackage)
			if (rootFusionPaths?.includes(filePath)) {
				workspace.fusionParser.rootFusionPaths.set(neosPackage, rootFusionPaths.filter(p => p !== filePath))
			}
		}

		workspace.buildMergedArrayTree("FusionFileChangeHandler deleted")
	}
}