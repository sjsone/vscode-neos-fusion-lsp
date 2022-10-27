export class EelHelperMethod {
	public name: string
	protected normalizedName: string
	public description: string | undefined
	public position: {
		begin: { line: number, column: number },
		end: { line: number, column: number }
	}

	constructor(name: string, description: string | undefined, position: { begin: { line: number, column: number }, end: { line: number, column: number } }) {
		this.name = name
		this.description = description
		this.position = position

		const nameWithoutGetter = this.name.replace(/get|is/, '')
		this.normalizedName = nameWithoutGetter[0].toLowerCase() + nameWithoutGetter.substring(1)
	}

	valid(identifier: string) {
		if(identifier === this.name) return true
		if(identifier === this.normalizedName) return true
		return false
	}
}