import * as NodeFs from "fs"
import * as NodePath from "path"
import { ConfigurationManager } from '../ConfigurationManager'
import { Logger } from '../Logging'
import { EELHelperToken, NeosPackage } from './NeosPackage'
export class NeosWorkspace extends Logger {
	protected workspacePath: string
	public configurationManager: ConfigurationManager

	protected packages: Map<string, NeosPackage> = new Map()

	constructor(workspacePath: string, name: string) {
		super(name)
		this.workspacePath = workspacePath
		this.configurationManager = new ConfigurationManager(workspacePath)
	}

	addPackage(packagePath: string) {
		try {
			const neosPackage = new NeosPackage(NodePath.resolve(this.workspacePath, packagePath), this)
			this.packages.set(neosPackage.getName(), neosPackage)
			this.configurationManager.addPackage(packagePath)
		} catch (error) {
			if (error instanceof Error) {
				if (error["code"] === 'ENOENT') {
					console.log('File not found!');
				} else {
					throw error;
				}
			}
		}
	}

	getEelHelperFromFullyQualifiedClassNameWithStaticMethod(fullyQualifiedClassName: string, staticMethod?: string) {
		if (!staticMethod) return this.getEelHelperFromFullyQualifiedClassName(fullyQualifiedClassName)

		return undefined
	}

	getEelHelperFromFullyQualifiedClassName(fullyQualifiedClassName: string) {
		for (const neosPackage of this.packages.values()) {
			const eelHelper = neosPackage.getEelHelperFromFullyQualifiedClassName(fullyQualifiedClassName)
			if (eelHelper) return eelHelper
		}
		return undefined
	}

	init() {
		this.configurationManager.buildConfiguration()
		this.initEelHelpers()
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