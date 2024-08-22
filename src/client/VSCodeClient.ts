import { GenericClient } from './GenericClient';

export class VSCodeClient extends GenericClient {
	getInfo(): string {
		return "VSCode Client"
	}

}