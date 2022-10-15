import * as NodeFs from "fs"
import * as NodePath from "path"
import { pathToUri } from '../util'


export class NeosPackageNamespace {
	protected name: string
	protected path: string

	protected fileUriCache: Map<string, string> = new Map()
	
	constructor(name: string, path: string) {
		this.name = name
		this.path = path

		this.log("Created", name, path)

		this.log(name, path)
	}

	getFileUriFromFullyQualifiedClassName (fullyQualifiedClassName: string) {
		if(this.fileUriCache.has(fullyQualifiedClassName)) return this.fileUriCache.get(fullyQualifiedClassName)
		const path = fullyQualifiedClassName.replace(this.name, "")

		const pathParts = path.split("\\")
		const className = pathParts.pop()
		const possibleFilePath = NodePath.join(this.path, ...pathParts, className+".php")

		this.log("Trying to get", className, possibleFilePath)

		if(!NodeFs.existsSync(possibleFilePath)) return undefined
		const phpFileSource = NodeFs.readFileSync(possibleFilePath).toString()

		const namespaceRegex = new RegExp(`namespace\\s+${(this.name + pathParts.join("\\")).split("\\").join("\\\\")};`)
		if(!namespaceRegex.test(phpFileSource)) return undefined

		const classRegex = new RegExp(`class\\s+${className}`)		
		if(!classRegex.test(phpFileSource)) return undefined
		
		const fileUri = pathToUri(possibleFilePath)

		this.fileUriCache.set(fullyQualifiedClassName, fileUri)

		this.log("  Found", fileUri)
		return fileUri
	}

	log(...text: any) {
		// console.log("[NeosPackageNamespace]", ...text)
	}
}
