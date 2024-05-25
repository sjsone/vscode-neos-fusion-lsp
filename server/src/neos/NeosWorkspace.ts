import * as NodeFs from "fs"
import * as NodePath from "path"
import { ConfigurationManager } from '../ConfigurationManager'
import { Logger } from '../common/Logging'
import { uriToPath } from '../common/util'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { FlowConfiguration } from './FlowConfiguration'
import { EELHelperToken, NeosPackage } from './NeosPackage'

export class NeosWorkspace extends Logger {
	protected workspacePath: string
	public configurationManager: ConfigurationManager

	protected packages: Map<string, NeosPackage> = new Map()

	constructor(public fusionWorkspace: FusionWorkspace) {
		super(fusionWorkspace.name)
		this.fusionWorkspace = fusionWorkspace
		this.workspacePath = uriToPath(fusionWorkspace.uri)
		this.configurationManager = new ConfigurationManager(this)
	}

	init(selectedFlowContextName?: string) {
		this.initConfiguration(selectedFlowContextName)
		this.initEelHelpers()
	}

	initEelHelpers() {
		for (const neosPackage of this.packages.values()) {
			neosPackage.initEelHelper()
		}
	}

	initConfiguration(selectedFlowContextName?: string) {
		this.configurationManager.buildConfiguration(selectedFlowContextName)
		const fusionWorkspacePath = uriToPath(this.fusionWorkspace.uri)
		if (NodeFs.existsSync(NodePath.join(fusionWorkspacePath, 'Configuration'))) {
			const configuration = FlowConfiguration.ForPath(this, fusionWorkspacePath)
			const settings = configuration["settingsConfiguration"]
			if (settings) this.configurationManager.addToMergedConfiguration(settings)
		}
	}

	addPackage(packagePath: string) {
		try {
			const neosPackage = new NeosPackage(packagePath, this)
			this.packages.set(neosPackage.getName(), neosPackage)
			this.configurationManager.addPackage(neosPackage, packagePath)
			return neosPackage
		} catch (error) {
			if (error instanceof Error) {
				if ("code" in error && error.code === 'ENOENT') {
					this.logError('File not found!', packagePath)
					this.logError("    Error: ", error)
				} else {
					this.logError("    Error: ", error)
					// throw error
				}
			}
		}
		return undefined
	}

	getPackages() {
		return this.packages
	}

	getPackage(packageName: string) {
		for (const neosPackage of this.packages.values()) {
			if (neosPackage.hasName(packageName)) return neosPackage
		}
		return undefined
	}

	getPackageByUri(uri: string): NeosPackage | undefined {
		const uriPath = uriToPath(uri)
		for (const neosPackage of this.packages.values()) {
			if (uriPath.startsWith(neosPackage.path)) return neosPackage
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
			if (neosPackage.hasName(packageName)) return neosPackage.getResourceUriPath(relativePath)
		}
		return undefined
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