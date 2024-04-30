import { ControllableError } from './ControllableError';

export abstract class UserPresentableError extends ControllableError {
	constructor(
		public readonly title: string,
		message: string
	) {
		super(message)
	}
}