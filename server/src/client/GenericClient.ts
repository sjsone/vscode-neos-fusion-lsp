import { Client } from './Client';

export class GenericClient extends Client {
	getInfo(): string {
		return "Generic Client"
	}
}