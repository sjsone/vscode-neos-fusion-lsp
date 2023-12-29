import {
	LanguageStatusItem,
	languages
} from 'vscode'
import { DocumentSelector } from 'vscode-languageclient'

export abstract class AbstractLanguageStatusBarItem {
	public readonly item: LanguageStatusItem

	protected getDocumentSelector(): DocumentSelector {
		return [{ scheme: 'file', language: 'fusion' }]
	}

	protected getId(): string {
		return "fusion." + this.getName()
	}

	public abstract getName(): string

	constructor() {
		this.item = languages.createLanguageStatusItem(this.getId(), this.getDocumentSelector())
		this.item.name = this.getName()
	}
}