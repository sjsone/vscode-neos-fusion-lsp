export class RootComposerJsonNotFoundError extends Error {

	constructor(protected path: string) {
		super(`Could not find root composer.json in ${path}`)
	}

	getPath() {
		return this.path
	}
}