import { ExtensionContext } from 'vscode'
import { Extension } from './Extension'

const extension = new Extension()

export function activate(context: ExtensionContext) {
	extension.activate(context)
}

export function deactivate(): Thenable<void> {
	return extension.deactivate()
}