import * as NodePath from "path"
import { Logger } from '../common/Logging'
import { uriToPath } from '../common/util'
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
					console.log('File not found!', packagePath)
				} else {
					throw error
				}
			}
		}
	}

	getPackages() {
		return this.packages
	}

	getPackage(packageName: string) {
		for (const neosPackage of this.packages.values()) {
			if (neosPackage.getPackageName() === packageName) return neosPackage
		}
		return undefined
	}

	getPackageByUri(uri: string): NeosPackage | undefined {
		const uriPath = uriToPath(uri)
		for (const neosPackage of this.packages.values()) {
			if (uriPath.startsWith(neosPackage["path"])) return neosPackage
		}

		return undefined
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

	getResourceUriPath(packageName: string, relativePath: string) {
		for (const neosPackage of this.packages.values()) {
			const resourceUriPath = neosPackage.getResourceUriPath(packageName, relativePath)
			if (resourceUriPath) return resourceUriPath
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