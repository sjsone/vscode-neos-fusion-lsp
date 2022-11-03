export class EelHelperMethod {
	public name: string
	protected normalizedName: string
	public description: string | undefined
	public position: {
		start: { line: number, character: number },
		end: { line: number, character: number }
	}

	constructor(name: string, description: string | undefined, position: { start: { line: number, character: number }, end: { line: number, character: number } }) {
		this.name = name
		this.description = description
		this.position = position

		const nameWithoutGetter = this.name.replace(/get|is/, '').trim() 
		this.normalizedName = nameWithoutGetter ? nameWithoutGetter[0].toLowerCase() + nameWithoutGetter.substring(1) : name
	}

	getNormalizedName() {
		return this.normalizedName
	}

	valid(identifier: string) {
		if(identifier === this.name) return true
		if(identifier === this.normalizedName) return true
		return false
	}
}