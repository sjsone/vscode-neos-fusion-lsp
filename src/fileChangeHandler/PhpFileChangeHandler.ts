import { FileChangeType, FileEvent } from 'vscode-languageserver'
import { AbstractFileChangeHandler } from './AbstractFileChangeHandler'
import { clearLineDataCacheForFile, uriToPath } from '../common/util'

export class PhpFileChangeHandler extends AbstractFileChangeHandler {
	canHandleFileEvent(fileEvent: FileEvent): boolean {
		this.logVerbose(`canHandleFileEvent: ${fileEvent.type === FileChangeType.Changed}`)
		return fileEvent.type === FileChangeType.Changed && fileEvent.uri.endsWith(".php")
	}

	public async handleChanged(fileEvent: FileEvent) {
		clearLineDataCacheForFile(fileEvent.uri)
		this.logVerbose(`handle change of file: ${fileEvent.uri}`)
		for (const workspace of this.languageServer.fusionWorkspaces) {
			for (const neosPackage of workspace.neosWorkspace.getPackages().values()) {
				const helper = neosPackage.getEelHelpers().find(helper => helper.uri === fileEvent.uri)
				if (!helper) continue

				this.logVerbose(`  File was EEL-Helper ${helper.name}`)

				const namespace = helper.namespace
				const classDefinition = namespace.getClassDefinitionFromFilePathAndClassName(uriToPath(helper.uri), helper.className, helper.pathParts)
				if (!classDefinition) continue

				this.logVerbose(`  Methods: then ${helper.methods.length} now ${classDefinition.methods.length}`)

				helper.methods = classDefinition.methods
				helper.position = classDefinition.position
			}
		}
	}

	public async handleCreated(fileEvent: FileEvent) {
		this.logError('handleCreated: Method not implemented.')
	}

	public async handleDeleted(fileEvent: FileEvent) {
		this.logError('handleDeleted: Method not implemented.')
	}
}