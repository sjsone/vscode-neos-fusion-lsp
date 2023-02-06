import { LinePosition } from '../common/LinePositionedNode'

export interface PhpMethodParameter {
	name: string,
	defaultValue?: string
	type?: string
}


export class PhpMethod {
	public name: string
	public description: string | undefined
	public position: {
		start: LinePosition,
		end: LinePosition
	}
	public parameters: PhpMethodParameter[]

	constructor(name: string, description: string | undefined, parameters: PhpMethodParameter[], position: { start: LinePosition, end: LinePosition }) {
		this.name = name
		this.description = description
		this.parameters = parameters
		this.position = position
	}
}