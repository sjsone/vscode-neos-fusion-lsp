import { ClientCapabilities } from 'vscode-languageserver'

export class ClientCapabilityService {
	constructor(
		protected clientCapabilities: ClientCapabilities
	) { }

	get(path: string) {
		const pathParts = <Array<keyof ClientCapabilities>>path.split(".")
		return pathParts.reduce((prev, cur) => prev === undefined ? undefined : prev[cur], this.clientCapabilities)
	}

	has(path: string) {
		return this.get(path) !== undefined
	}
}