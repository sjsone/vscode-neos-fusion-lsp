import * as NodeFs from "fs"
import * as NodePath from "path"
import { EelHelperMethod, EelHelperMethodParameter } from '../eel/EelHelperMethod'
import { getLineNumberOfChar, pathToUri } from '../util'

export interface ClassDefinition {
	uri: string
	methods: EelHelperMethod[]
	position: {
		start: { line: number, character: number }
		end: { line: number, character: number }
	},
}

export class NeosPackageNamespace {
	protected name: string
	protected path: string

	protected fileUriCache: Map<string, string> = new Map()

	constructor(name: string, path: string) {
		this.name = name
		this.path = path
	}

	getFileUriFromFullyQualifiedClassName(fullyQualifiedClassName: string) {
		if (this.fileUriCache.has(fullyQualifiedClassName)) return this.fileUriCache.get(fullyQualifiedClassName)
		const path = fullyQualifiedClassName.replace(this.name, "")

		const pathParts = path.split("\\")
		const className = pathParts.pop()
		const possibleFilePath = NodePath.join(this.path, ...pathParts, className + ".php")

		if (!NodeFs.existsSync(possibleFilePath)) return undefined
		const phpFileSource = NodeFs.readFileSync(possibleFilePath).toString()

		const namespaceRegex = new RegExp(`namespace\\s+${(this.name + pathParts.join("\\")).split("\\").join("\\\\")};`)
		if (!namespaceRegex.test(phpFileSource)) return undefined

		const classRegex = new RegExp(`class\\s+${className}`)
		if (!classRegex.test(phpFileSource)) return undefined

		const fileUri = pathToUri(possibleFilePath)

		this.fileUriCache.set(fullyQualifiedClassName, fileUri)

		return fileUri
	}


	getClassDefinitionFromFullyQualifiedClassName(fullyQualifiedClassName: string): ClassDefinition {
		const path = fullyQualifiedClassName.replace(this.name, "")

		const pathParts = path.split("\\")
		const className = pathParts.pop()
		const possibleFilePath = NodePath.join(this.path, ...pathParts, className + ".php")

		if (!NodeFs.existsSync(possibleFilePath)) return undefined
		const phpFileSource = NodeFs.readFileSync(possibleFilePath).toString()

		const namespaceRegex = new RegExp(`namespace\\s+${(this.name + pathParts.join("\\")).split("\\").join("\\\\")};`)
		if (!namespaceRegex.test(phpFileSource)) return undefined

		const classRegex = new RegExp(`class\\s+${className}`)

		const classMatch = classRegex.exec(phpFileSource)
		if (classMatch === null) return undefined

		const begin = phpFileSource.indexOf(classMatch[0])
		const end = begin + classMatch[0].length
		const fileUri = pathToUri(possibleFilePath)

		const methodsRegex = /(public\s+(static\s+)?function\s+([a-zA-Z]+)\s?\((?: *([^)]+?) *\))?)/g
		let lastIndex = 0
		const rest = phpFileSource
		let match = methodsRegex.exec(rest)

		const methods: EelHelperMethod[] = []

		while (match != null) {
			const fullDefinition = match[1]
			const isStatic = !!match[2]
			const name = match[3]
			const rawParameters = match[4] + ')'

			const parameters = this.parseMethodParameters(rawParameters)

			const identifierIndex = rest.substring(lastIndex).indexOf(fullDefinition) + lastIndex
			const { description } = this.parseMethodComment(identifierIndex, phpFileSource)

			methods.push(new EelHelperMethod(name, description, parameters, {
				start: getLineNumberOfChar(phpFileSource, identifierIndex),
				end: getLineNumberOfChar(phpFileSource, identifierIndex + fullDefinition.length)
			}))

			lastIndex = identifierIndex + fullDefinition.length
			match = methodsRegex.exec(rest)
		}

		return {
			uri: fileUri,
			methods,
			position: {
				start: getLineNumberOfChar(phpFileSource, begin),
				end: getLineNumberOfChar(phpFileSource, end)
			},
		}
	}

	protected parseMethodParameters(rawParameters: string): EelHelperMethodParameter[] {
		const parametersRegex = /(\w+ )?(\$\w*)( ?= ?.*?)?(?:,|\))/g
		let match = parametersRegex.exec(rawParameters)
		const parameters = []
		let runAwayPrevention = 0
		while (match != null && runAwayPrevention++ < 1000) {
			parameters.push({
				name: match[2],
				defaultValue: match[3],
				type: match[1]
			})
			match = parametersRegex.exec(rawParameters)
		}
		return parameters
	}

	protected parseMethodComment(offset: number, code: string) {
		const reversed = code.substring(0, offset).split('').reverse().join('')
		const reversedDescriptionRegex = /^\s*\/\*([\s\S]*?)\s*\*\*\//
		const reversedDescriptionMatch = reversedDescriptionRegex.exec(reversed)

		const descriptionParts = []
		if (reversedDescriptionMatch) {
			const fullDocBlock = reversedDescriptionMatch[1].split('').reverse().join('')
			const docLineRegex = /^\s*\* *(@\w+)?(.+)?$/gm
			let docLineMatch = docLineRegex.exec(fullDocBlock)
			while (docLineMatch && docLineMatch[2]) {
				descriptionParts.push(docLineMatch[2])
				// docLineMatch[1] => "@return", "@param", ...
				docLineMatch = docLineRegex.exec(fullDocBlock)
			}
		}

		return {
			description: descriptionParts.join("\n")
		}
	}
}
