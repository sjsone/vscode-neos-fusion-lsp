import { LinePosition } from '../common/LinePositionedNode'

export interface PhpMethodParameter {
	name: string,
	defaultValue?: string
	spread: boolean,
	type?: string
}


export class PhpMethod {
	constructor(
		public name: string,
		public description: string | undefined,
		public parameters: PhpMethodParameter[],
		public returnType: string | undefined,
		public position: { start: LinePosition, end: LinePosition }
	) {
	}
}