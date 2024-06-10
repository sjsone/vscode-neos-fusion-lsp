import { LinePosition } from '../common/LinePositionedNode'


export interface PhpTypeWithDescription {
	type?: string
	description?: string
}
export interface PhpMethodParameter extends PhpTypeWithDescription {
	name: string,
	defaultValue?: string
	spread: boolean,
}

export class PhpMethod {
	constructor(
		public name: string,
		public description: string | undefined,
		public parameters: PhpMethodParameter[],
		public position: {
			start: LinePosition,
			end: LinePosition
		},
		public returns: PhpTypeWithDescription | undefined
	) { }
}