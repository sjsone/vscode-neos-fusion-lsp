import { FileChangeType, FileEvent } from 'vscode-languageserver'
import { AbstractFunctionality } from '../common/AbstractFunctionality'
import { clearLineDataCacheForFile } from '../common/util'

export abstract class AbstractFileChangeHandler extends AbstractFunctionality {
	abstract canHandleFileEvent(fileEvent: FileEvent): boolean

	public async tryToHandle(fileEvent: FileEvent) {
		if (this.canHandleFileEvent(fileEvent)) return this.handle(fileEvent)
	}

	public handle(fileEvent: FileEvent) {
		if (fileEvent.type === FileChangeType.Changed) return this.handleChanged(fileEvent)
		if (fileEvent.type === FileChangeType.Created) return this.handleCreated(fileEvent)
		if (fileEvent.type === FileChangeType.Deleted) return this.handleDeleted(fileEvent)
	}

	public abstract handleCreated(fileEvent: FileEvent): Promise<void>
	public abstract handleChanged(fileEvent: FileEvent): Promise<void>

	public async handleDeleted(fileEvent: FileEvent) {
		clearLineDataCacheForFile(fileEvent.uri)
	}
}