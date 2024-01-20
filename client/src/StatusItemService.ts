import { languages, LanguageStatusItem } from 'vscode'
import { DocumentSelector } from 'vscode-languageclient'

export type LanguageStatusItemConfigurationKeys = Exclude<keyof LanguageStatusItem, "id">
export type LanguageStatusItemConfiguration = { [key in LanguageStatusItemConfigurationKeys]: any }

export class StatusItemService {
	protected statusItems: Map<string, LanguageStatusItem> = new Map()
	protected documentSelector: DocumentSelector

	constructor(documentSelector: DocumentSelector) {
		this.documentSelector = documentSelector
	}

	createStatusItem(id: string, configuration: undefined | LanguageStatusItemConfiguration = undefined) {
		const item = languages.createLanguageStatusItem(id, this.documentSelector)
		this.statusItems.set(id, item)

		if (configuration === undefined) return
		for (const key in configuration) {
			(<LanguageStatusItemConfiguration>item)[<LanguageStatusItemConfigurationKeys>key] = configuration[<LanguageStatusItemConfigurationKeys>key]
		}
	}

	disposeStatusItem(id: string) {
		if (!this.statusItems.has(id)) return
		const item = this.statusItems.get(id)
		item?.dispose()
		this.statusItems.delete(id)
	}
}