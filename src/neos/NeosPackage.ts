import * as NodeFs from "fs"
import * as NodePath from "path"
import { FlowConfiguration } from './FlowConfiguration'
import { NeosPackageNamespace } from './NeosPackageNamespace'

export class NeosPackage {
	protected path: string

	protected composerJson: any

	protected namespaces: Map<string, NeosPackageNamespace> = new Map()
	protected eelHelpers: {name: string, uri: string, regex: RegExp}[] = []
	
	constructor(path: string) {
		this.path = path


		this.initComposerJson()
		this.initNamespaceLoading()
		this.initConfiguration()
	}

	protected initComposerJson() {
		const composerJsonFilePath = NodePath.join(this.path, "composer.json")
		this.composerJson = JSON.parse(NodeFs.readFileSync(composerJsonFilePath).toString())
	}

	protected initNamespaceLoading() {
		const autoloadNamespaces = this.composerJson.autoload["psr-4"]
		for(const namespace in autoloadNamespaces) {
			const namespacePath = autoloadNamespaces[namespace]
			this.namespaces.set(namespace, new NeosPackageNamespace(namespace, NodePath.join(this.path, namespacePath)))
		}
	}

	protected initConfiguration() {
		const configurationFolderPath = NodePath.join(this.path, "Configuration")
		const neosConfiguration = FlowConfiguration.FromFolder(configurationFolderPath)
		const defaultNeosFusionContext = neosConfiguration.get<any>("Neos.Fusion.defaultContext")
		// this.log("defaultNeosFusionContext", defaultNeosFusionContext)
		for(const eelHelperPrefix in defaultNeosFusionContext) {
			const fqcn = defaultNeosFusionContext[eelHelperPrefix]
			const eelHelperFileUri = this.getFileUriFromFullyQualifiedClassName(fqcn)
			if(eelHelperFileUri !== undefined) {
				this.log("Found EEL-Helper", eelHelperPrefix, eelHelperFileUri)
				this.eelHelpers.push({
					name: eelHelperPrefix,
					uri: eelHelperFileUri,
					regex: RegExp(`(${eelHelperPrefix.split('.').join('\\.')})(\\.\\w+)?`)
				})
			} 
		}
	}

	getFileUriFromFullyQualifiedClassName(fullyQualifiedClassName: string) {
		for(const namespaceEntry of this.namespaces.entries()) {
			if(fullyQualifiedClassName.startsWith(namespaceEntry[0])) {
				return namespaceEntry[1].getFileUriFromFullyQualifiedClassName(fullyQualifiedClassName)
			}
		}
	}

	getEelHelpers() {
		return this.eelHelpers
	}

	getName() {
		return this.composerJson.name
	}

	log(...text: any) {
		console.log("[NeosPackage]", ...text)
	}
}