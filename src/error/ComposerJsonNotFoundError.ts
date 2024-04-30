import type { NeosWorkspace } from '../neos/NeosWorkspace';
import { UserPresentableError } from './UserPresentableError';

export class ComposerJsonNotFoundError extends UserPresentableError {
	constructor(
		public readonly neosWorkspace: NeosWorkspace,
		public readonly path: string
	) {
		super("composer.json not found", `Searched in ${path} for a \`composer.json\``)
	}
}