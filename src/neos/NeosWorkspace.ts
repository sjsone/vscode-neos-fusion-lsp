import * as NodeFs from "fs"
import * as NodePath from "path"
import { Logger } from '../Logging'
import { EELHelperToken, NeosPackage } from './NeosPackage'
export class NeosWorkspace extends Logger {
	protected workspacePath: string

	protected packages: Map<string, NeosPackage> = new Map()

	constructor(workspacePath: string, name: string) {
		super(name)
		this.workspacePath = workspacePath
	}

	addPackage(packagePath: string) {
		try {
			const neosPackage = new NeosPackage(NodePath.resolve(this.workspacePath, packagePath), this)
			this.packages.set(neosPackage.getName(), neosPackage)
		} catch (error) {
			if (error instanceof Error) {
				if (error["code"] === 'ENOENT') {
					console.log('File not found!')
				} else {
					throw error
				}
			}
		}
	}

	getEelHelperFromFullyQualifiedClassNameWithStaticMethod(fullyQualifiedClassName: string, staticMethod?: string) {
		if (!staticMethod) return this.getClassDefinitionFromFullyQualifiedClassName(fullyQualifiedClassName)
		return undefined
	}

	getClassDefinitionFromFullyQualifiedClassName(fullyQualifiedClassName: string) {
		for (const neosPackage of this.packages.values()) {
			const classDefinition = neosPackage.getClassDefinitionFromFullyQualifiedClassName(fullyQualifiedClassName)
			if (classDefinition) return classDefinition
		}
		return undefined
	}

	getFileUriFromFullyQualifiedClassName(fullyQualifiedClassName: string) {
		for (const neosPackage of this.packages.values()) {
			const fileUri = neosPackage.getFileUriFromFullyQualifiedClassName(fullyQualifiedClassName)
			if (fileUri) return fileUri
		}
		return undefined
	}

	getResourceUri(packageName: string, relativePath: string) {
		for (const neosPackage of this.packages.values()) {
			const resourceUri = neosPackage.getResourceUri(packageName, relativePath)
			if (resourceUri) return resourceUri
		}
		return undefined
	}

	initEelHelpers() {
		for (const neosPackage of this.packages.values()) {
			neosPackage.initEelHelper()
		}
	}

	getEelHelperTokens() {
		const eelHelperTokens: EELHelperToken[] = []
		for (const neosPackage of this.packages.values()) {
			eelHelperTokens.push(...neosPackage.getEelHelpers())
		}
		return eelHelperTokens
	}

	getEelHelperTokensByName(name: string) {
		return this.getEelHelperTokens().find(eelHelper => eelHelper.name === name)
	}
}