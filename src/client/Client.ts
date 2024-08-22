import { ClientCapabilities } from 'vscode-languageserver'

export abstract class Client {
	public clientCapabilities!: ClientCapabilities

	setCapabilities(clientCapabilities: ClientCapabilities) {
		this.clientCapabilities = clientCapabilities
	}

	abstract getInfo(): string

}