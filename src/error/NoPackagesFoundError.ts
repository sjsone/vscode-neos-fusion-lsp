import { UserPresentableError } from './UserPresentableError';

export class NoPackagesFoundError extends UserPresentableError {
	constructor() {
		super("No Packages found", "No packages could be found. Please check the `neosFusionLsp.folders.packages` and `neosFusionLsp.diagnostics.ignore.folders` configurations.")
	}
}