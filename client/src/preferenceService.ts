import {
	OutputChannel, workspace, ConfigurationTarget
} from 'vscode'


export type ExternalExtensionPreferenceModification<T> = ExternalExtensionPreferenceModificationNonNullable<T> | ExternalExtensionPreferenceModificationNullable<T>

export interface ExternalExtensionPreferenceModificationNonNullable<T> extends ExternalExtensionPreferenceModificationBase {
	allowNull?: false | undefined
	modifier: (value: T) => T
}

export interface ExternalExtensionPreferenceModificationNullable<T> extends ExternalExtensionPreferenceModificationBase {
	allowNull: true
	modifier: (value: T | null) => T | null
}

export interface ExternalExtensionPreferenceModificationBase {
	path: string
	allowNull?: boolean
}


export class PreferenceService {
	protected outputChannel: OutputChannel

	constructor(outputChannel: OutputChannel) {
		this.outputChannel = outputChannel
	}

	public modify<T>(modification: ExternalExtensionPreferenceModification<T>) {
		const configuration = workspace.getConfiguration()
		const target = ConfigurationTarget.Global
		const overrideInLanguage = false
		const preference = <T>configuration.get(modification.path, null)

		if (preference !== null || modification.allowNull) {
			const newPreference = modification.modifier(preference)
			if (newPreference !== null || modification.allowNull) {
				configuration.update(modification.path, newPreference, target, overrideInLanguage)
			}
		}
	}
}