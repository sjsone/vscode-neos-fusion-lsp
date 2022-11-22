import { LinePosition } from '../LinePositionedNode'

export interface EelHelperMethodParameter {
	name: string,
	defaultValue?: string
	type?: string
}

export class EelHelperMethod {
	public name: string
	protected normalizedName: string
	public description: string | undefined
	public position: {
		start: LinePosition,
		end: LinePosition
	}
	public parameters: EelHelperMethodParameter[]

	constructor(name: string, description: string | undefined, parameters: EelHelperMethodParameter[], position: { start: LinePosition, end: LinePosition }) {
		this.name = name
		this.description = description
		this.parameters = parameters
		this.position = position

		const nameWithoutGetter = this.name.replace(/get|is/, '').trim()
		this.normalizedName = nameWithoutGetter ? nameWithoutGetter[0].toLowerCase() + nameWithoutGetter.substring(1) : name
	}

	getNormalizedName() {
		return this.normalizedName
	}

	valid(identifier: string) {
		if (identifier === this.name) return true
		if (identifier === this.normalizedName) return true
		return false
	}
}