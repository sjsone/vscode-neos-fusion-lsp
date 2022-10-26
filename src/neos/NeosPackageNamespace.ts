import * as NodeFs from "fs"
import * as NodePath from "path"
import { getLineNumberOfChar, pathToUri } from '../util'
import { EELHelperMethodToken } from './NeosPackage'


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


	getEelHelperFromFullyQualifiedClassName(fullyQualifiedClassName: string) {
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

		const methodsRegex = /(public\s+(static\s+)?function\s+([a-zA-Z]+)\s?\()/g

		let lastIndex = 0
		const rest = phpFileSource
		let match = methodsRegex.exec(rest)

		const methods: EELHelperMethodToken[] = []

		while (match != null) {
			const fullDefinition = match[1]
			const isStatic = !!match[2]
			const name = match[3]

			const identifierIndex = rest.substring(lastIndex).indexOf(fullDefinition) + lastIndex

			const { description } = this.parseMethodComment(identifierIndex, phpFileSource)

			methods.push({
				name,
				description,
				position: {
					begin: getLineNumberOfChar(phpFileSource, identifierIndex),
					end: getLineNumberOfChar(phpFileSource, identifierIndex + fullDefinition.length)
				}
			})

			lastIndex = identifierIndex + fullDefinition.length
			match = methodsRegex.exec(rest)
		}

		return {
			uri: fileUri,
			methods,
			position: {
				begin: getLineNumberOfChar(phpFileSource, begin),
				end: getLineNumberOfChar(phpFileSource, end)
			},
		}
	}

	protected parseMethodComment(offset: number, code: string) {
		const reversed = code.substring(0, offset).split('').reverse().join('')
		const reversedDescriptionRegex = /^\s*\/\*([\s\S]*?)\s*\*\*\//
		const reversedDescriptionMatch = reversedDescriptionRegex.exec(reversed)

		const descriptionParts = []
		if (reversedDescriptionMatch) {
			const fullDocBlock = reversedDescriptionMatch[1].split('').reverse().join('')
			const docLineRegex = /^\s*\*\ *(@\w+)?(.+)?$/gm
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
