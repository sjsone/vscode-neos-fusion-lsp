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
		const neosPackage = new NeosPackage(NodePath.join(this.workspacePath, packagePath), this)
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

	getEelHelperFileUris() {
		const fileUris: EELHelperToken[] = []

		for(const neosPackage of this.packages.values()) {
			fileUris.push(...neosPackage.getEelHelpers())
		}
		return fileUris
	}
}