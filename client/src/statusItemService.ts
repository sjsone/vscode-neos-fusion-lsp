import { languages, LanguageStatusItem } from 'vscode';
import { DocumentSelector } from 'vscode-languageclient';

export class StatusItemService {
	protected statusItems: Map<string, LanguageStatusItem> = new Map()
	protected documentSelector: DocumentSelector

	constructor(documentSelector: DocumentSelector) {
		this.documentSelector = documentSelector
	}

	createStatusItem(id: string, configuration: undefined | {[key: string]: any} = undefined) {
		const item = languages.createLanguageStatusItem(id, this.documentSelector)
		this.statusItems.set(id, item)

		if(configuration !== undefined) {
			for(const key in configuration) {
				item[key] = configuration[key]
			}
		}
	}

	disposeStatusItem(id: string) {
		if(!this.statusItems.has(id)) return
		const item = this.statusItems.get(id)
		item.dispose()
		this.statusItems.delete(id)
	}
}