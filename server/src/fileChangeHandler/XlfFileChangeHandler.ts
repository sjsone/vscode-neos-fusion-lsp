import { FileChangeType, FileEvent } from 'vscode-languageserver'
import { AbstractFileChangeHandler } from './AbstractFileChangeHandler'
import { clearLineDataCacheForFile, uriToPath } from '../common/util'
import { XLIFFTranslationFile } from '../translations/XLIFFTranslationFile'

export class XlfFileChangeHandler extends AbstractFileChangeHandler {
	canHandleFileEvent(fileEvent: FileEvent): boolean {
		return fileEvent.type !== FileChangeType.Deleted && fileEvent.uri.endsWith(".xlf")
	}

	public async handleChanged(fileEvent: FileEvent) {
		clearLineDataCacheForFile(fileEvent.uri)
		for (const workspace of this.languageServer.fusionWorkspaces) {
			const translationFile = workspace.getTranslationFileByUri(fileEvent.uri)
			if (!translationFile) continue
			translationFile.parse().catch(error => this.logError("handleFileChanged", error))
		}
	}

	public async handleCreated(fileEvent: FileEvent) {
		const workspace = this.languageServer.getWorkspaceForFileUri(fileEvent.uri)
		if (!workspace) return

		const neosPackage = workspace.neosWorkspace.getPackageByUri(fileEvent.uri)
		if (!neosPackage) return

		const basePath = neosPackage.getTranslationsBasePath()
		const filePath = uriToPath(fileEvent.uri)

		const translationFile = XLIFFTranslationFile.FromFilePath(neosPackage, filePath, basePath)
		await translationFile.parse()
		workspace.translationFiles.push(translationFile)
	}
}