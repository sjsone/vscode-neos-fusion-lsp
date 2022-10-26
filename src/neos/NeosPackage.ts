import * as NodeFs from "fs"
import * as NodePath from "path"
import { Logger } from '../Logging'
import { FlowConfiguration } from './FlowConfiguration'
import { NeosPackageNamespace } from './NeosPackageNamespace'
import { NeosWorkspace } from './NeosWorkspace'

export interface EELHelperToken {
	name: string,
	uri: string,
	regex: RegExp,
	position: {
		begin: { line: number, column: number },
		end: { line: number, column: number }
	},
	methods: EELHelperMethodToken[]
}

export interface EELHelperMethodToken {
	name: string,
	description: string | undefined,
	position: {
		begin: { line: number, column: number },
		end: { line: number, column: number }
	}
}
export class NeosPackage extends Logger {
	protected path: string
	protected neosWorkspace: NeosWorkspace

	protected composerJson: any

	protected namespaces: Map<string, NeosPackageNamespace> = new Map()
	protected eelHelpers: EELHelperToken[] = []

	protected debug: boolean

	constructor(path: string, neosWorkspace: NeosWorkspace) {
		const composerJsonFilePath = NodePath.join(path, "composer.json")
		const composerJson = JSON.parse(NodeFs.readFileSync(composerJsonFilePath).toString())

		super(composerJson.name)

		this.path = path
		this.neosWorkspace = neosWorkspace

		this.composerJson = composerJson

		this.debug = this.getName() === "neos/fusion"

		this.initNamespaceLoading()
	}

	protected initNamespaceLoading() {
		const autoloadNamespaces = this.composerJson?.autoload?.["psr-4"] ?? []
		for (const namespace in autoloadNamespaces) {
			const namespacePath = autoloadNamespaces[namespace]
			this.namespaces.set(namespace, new NeosPackageNamespace(namespace, NodePath.join(this.path, namespacePath)))
		}
	}

	public initEelHelper() {
		const configurationFolderPath = NodePath.join(this.path, "Configuration")
		if(!NodeFs.existsSync(configurationFolderPath)) return undefined
		const neosConfiguration = FlowConfiguration.FromFolder(configurationFolderPath)

		if(neosConfiguration["parsedYamlConfiguration"] === null) return undefined
		
		const defaultNeosFusionContext = neosConfiguration.get<any>("Neos.Fusion.defaultContext")
		// this.log("defaultNeosFusionContext", defaultNeosFusionContext)

		if(!defaultNeosFusionContext) return undefined
		this.logVerbose("Found EEL-Helpers:")
		for (const eelHelperPrefix in defaultNeosFusionContext) {
			// TODO: Handle methods like "Neos\Eel\FlowQuery\FlowQuery::q" 
			const fqcn = defaultNeosFusionContext[eelHelperPrefix]
			const eelHelper = this.neosWorkspace.getEelHelperFromFullyQualifiedClassName(fqcn)
			if (eelHelper !== undefined) {
				const location = {
					name: eelHelperPrefix,
					uri: eelHelper.uri,
					regex: RegExp(`(${eelHelperPrefix.split('.').join('\\.')})(\\.\\w+)?`),
					position: eelHelper.position,
					methods: eelHelper.methods
				}
				this.eelHelpers.push(location)
				this.logVerbose(`|-"${eelHelperPrefix}" with ${eelHelper.methods.length} methods`)
				this.logDebug(` \\- Methods: ${eelHelper.methods.map(method => method.name).join(", ")}`)
			}
		}

		this.logVerbose(`Found ${this.eelHelpers.length} EEL-Helpers`)
	}

	getFileUriFromFullyQualifiedClassName(fullyQualifiedClassName: string) {
		for (const namespaceEntry of this.namespaces.entries()) {
			if (fullyQualifiedClassName.startsWith(namespaceEntry[0])) {
				return namespaceEntry[1].getFileUriFromFullyQualifiedClassName(fullyQualifiedClassName)
			}
		}
		return undefined
	}

	getEelHelperFromFullyQualifiedClassName(fullyQualifiedClassName: string) {
		for (const namespaceEntry of this.namespaces.entries()) {
			if (fullyQualifiedClassName.startsWith(namespaceEntry[0])) {
				return namespaceEntry[1].getEelHelperFromFullyQualifiedClassName(fullyQualifiedClassName)
			}
		}
		return undefined
	}

	getEelHelpers() {
		return this.eelHelpers
	}

	getName() {
		return this.composerJson.name
	}

	log(...text: any) {
		if(this.debug) console.log("[NeosPackage]", ...text)
	}
}