import { Client } from './client/Client';
import { GenericClient } from './client/GenericClient';
import { VSCodeClient } from './client/VSCodeClient';

const defaultClient = () => new GenericClient

const resolveClientByName = (clientName: string) => {
	switch (clientName.toLowerCase()) {
		case "vscode": return new VSCodeClient
		default: return defaultClient()
	}
}

export const resolveClient = (): Client => {
	const argName = "--client"
	for (let i = 2; i < process.argv.length; i++) {
		const arg = process.argv[i];
		if (arg === argName && i + 1 < process.argv.length) {
			return resolveClientByName(process.argv[i + 1]);
		} else {
			const args = arg.split('=');
			if (args[0] === argName) {
				return resolveClientByName(args[1]);
			}
		}
	}

	return defaultClient()
}