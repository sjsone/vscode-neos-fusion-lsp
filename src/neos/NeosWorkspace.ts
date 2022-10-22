import * as NodeFs from "fs"
import * as NodePath from "path"
import { FlowConfiguration } from './FlowConfiguration'
import { EELHelperToken, NeosPackage } from './NeosPackage'
export class NeosWorkspace {
	protected workspacePath: string 

	protected packages: Map<string,NeosPackage> = new Map()

	constructor(workspacePath: string) {
		this.workspacePath = workspacePath
	}

	addPackage(packagePath: string) {
		const neosPackage = new NeosPackage(NodePath.resolve(this.workspacePath, packagePath), this)
		this.packages.set(neosPackage.getName(), neosPackage)
	}

	getEelHelperFromFullyQualifiedClassName(fullyQualifiedClassName: string) {
		for(const neosPackage of this.packages.values()) {
			const eelHelper = neosPackage.getEelHelperFromFullyQualifiedClassName(fullyQualifiedClassName)
			if(eelHelper) return eelHelper
		}
		return undefined
	}

	initEelHelpers() {
		for(const neosPackage of this.packages.values()) {
			neosPackage.initEelHelper()
		}
	}

	getEelHelperTokens() {
		const eelHelperTokens: EELHelperToken[] = []
		for(const neosPackage of this.packages.values()) {
			eelHelperTokens.push(...neosPackage.getEelHelpers())
		}
		return eelHelperTokens
	}

	getEelHelperTokensByName(name: string) {
		return this.getEelHelperTokens().find(eelHelper => eelHelper.name === name)
	}
}