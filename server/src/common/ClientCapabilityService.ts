import { ClientCapabilities } from 'vscode-languageserver';

export class ClientCapabilityService {
	constructor(
		protected clientCapabilities: ClientCapabilities
	) { }

	get(path: string) {
		return path.split(".").reduce((prev, cur) => prev === undefined ? undefined : prev[cur], this.clientCapabilities)
	}

	has(path: string) {
		return this.get(path) !== undefined
	}
}