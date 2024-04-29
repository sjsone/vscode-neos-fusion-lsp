import { LinePosition } from '../common/LinePositionedNode'
import { PhpMethod, PhpMethodParameter } from './PhpMethod'


export class EelHelperMethod extends PhpMethod {
	protected normalizedName: string

	constructor(name: string, description: string | undefined, parameters: PhpMethodParameter[], returnType: string | undefined, position: { start: LinePosition, end: LinePosition }) {
		super(name, description, parameters, returnType, position)

		const nameWithoutGetter = this.name.replace(/get/, '').trim()
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