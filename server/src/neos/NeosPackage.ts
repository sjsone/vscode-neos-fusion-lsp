import * as NodeFs from "fs"
import * as NodePath from "path"
import { EelHelperMethod } from '../eel/EelHelperMethod'
import { Logger } from '../Logging'
import { FlowConfiguration } from './FlowConfiguration'
import { NeosPackageNamespace } from './NeosPackageNamespace'
import { NeosWorkspace } from './NeosWorkspace'

export interface EELHelperToken {
	name: string,
	uri: string,
	regex: RegExp,
	position: {
		start: { line: number, character: number },
		end: { line: number, character: number }
	},
	methods: EelHelperMethod[]
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
		if (!NodeFs.existsSync(configurationFolderPath)) return undefined
		const neosConfiguration = FlowConfiguration.FromFolder(configurationFolderPath)

		if (neosConfiguration["parsedYamlConfiguration"] === null) return undefined

		const defaultNeosFusionContext = neosConfiguration.get<any>("Neos.Fusion.defaultContext")
		if (!defaultNeosFusionContext) return undefined

		this.logVerbose("Found EEL-Helpers:")
		for (const eelHelperPrefix in defaultNeosFusionContext) {
			const { fqcn, staticMethod } = this.extractFqcnAndStaticMethodFromDefaultContextEntry(<string>defaultNeosFusionContext[eelHelperPrefix])
			const eelHelper = this.neosWorkspace.getEelHelperFromFullyQualifiedClassNameWithStaticMethod(fqcn, staticMethod)
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

	extractFqcnAndStaticMethodFromDefaultContextEntry(path: string) {
		const staticMethodRegex = /^(.*?)(?:::(.*))?$/
		const match = staticMethodRegex.exec(this.trimLeadingBackslash(path))
		return {
			fqcn: match[1],
			staticMethod: match[2]
		}
	}

	getFileUriFromFullyQualifiedClassName(fullyQualifiedClassName: string) {
		for (const namespaceEntry of this.namespaces.entries()) {
			if (fullyQualifiedClassName.startsWith(namespaceEntry[0])) {
				return namespaceEntry[1].getFileUriFromFullyQualifiedClassName(fullyQualifiedClassName)
			}
		}
		return undefined
	}

	getClassDefinitionFromFullyQualifiedClassName(fullyQualifiedClassName: string) {
		for (const namespaceEntry of this.namespaces.entries()) {
			if (fullyQualifiedClassName.startsWith(namespaceEntry[0])) {
				return namespaceEntry[1].getClassDefinitionFromFullyQualifiedClassName(fullyQualifiedClassName)
			}
		}
		return undefined
	}

	getResourceUriPath(packageName: string, relativePath: string) {
		if (this.getPackageName() === packageName) {
			return NodePath.join(this.path, "Resources", relativePath)
		}
	}

	getEelHelpers() {
		return this.eelHelpers
	}

	getName() {
		return this.composerJson.name
	}

	getPackageName() {
		const packageKey = this.composerJson.extra?.neos?.["package-key"]
		const name = this.getName()
		return packageKey ?? name.split("/").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('.')
	}

	log(...text: any) {
		if (this.debug) console.log("[NeosPackage]", ...text)
	}

	trimLeadingBackslash(fqcn: string) {
		return fqcn[0] === "\\" ? fqcn.substring(1) : fqcn
	}
}