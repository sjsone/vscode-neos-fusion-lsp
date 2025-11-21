import { RebuildWorkspacesConfigurationCommand } from '../commands/RebuildWorkspacesConfigurationCommand'
import { AbstractLanguageStatusBarItem } from './AbstractLanguageStatusBarItem'

export class RebuildConfiguration extends AbstractLanguageStatusBarItem {
	public getName(): string {
		return 'rebuild'
	}

	constructor() {
		super()

		this.item.text = "Rebuild Configuration"
		this.item.command = {
			title: "rebuild",
			command: RebuildWorkspacesConfigurationCommand.Identifier,
			tooltip: "Rebuild configuration and everything related for all workspaces"
		}
	}
}