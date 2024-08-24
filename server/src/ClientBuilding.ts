import { Client } from './client/Client'
import { GenericClient } from './client/GenericClient'
import { IntelliJClient } from './client/IntelliJClient'
import { VSCodeClient } from './client/VSCodeClient'

const defaultClient = () => new GenericClient

const resolveClientByName = (clientName: string) => {
	switch (clientName.toLowerCase()) {
		case "vscode": return new VSCodeClient
		case "intellij": return new IntelliJClient
		default: return defaultClient()
	}
}

const resolveArgumentValue = (argName: string): undefined | string => {
	for (let i = 2; i < process.argv.length; i++) {
		const arg = process.argv[i]
		if (arg === argName && i + 1 < process.argv.length) return process.argv[i + 1]
		else {
			const args = arg.split('=')
			if (args[0] === argName) return args[1]
		}
	}

	return undefined
}

export const resolveClient = (): Client => {
	const clientNameArgument = "--client"
	const clientName = resolveArgumentValue(clientNameArgument)
	if (clientName) return resolveClientByName(clientName)

	return defaultClient()
}