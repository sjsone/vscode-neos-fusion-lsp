import { Extension } from '../Extension'

export type AbstractCommandConstructor<T extends AbstractCommand = AbstractCommand> = { Identifier: string } & (new (...args: any[]) => T);

export abstract class AbstractCommand {
	protected extension: Extension
	static Identifier = "abstract_command"

	constructor(extension: Extension) {
		this.extension = extension
	}

	public abstract callback(...args: any[]): Promise<any>

	createCallback() {
		return this.callback.bind(this)
	}
}