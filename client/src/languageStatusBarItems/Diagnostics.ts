import { AbstractLanguageStatusBarItem } from './AbstractLanguageStatusBarItem'

export class Diagnostics extends AbstractLanguageStatusBarItem {
	public getName(): string {
		return 'diagnostics'
	}

	constructor() {
		super()
		this.item.text = "Running diagnostics"
	}
}