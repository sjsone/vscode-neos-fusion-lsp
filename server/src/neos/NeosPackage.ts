import * as NodePath from "path"
import * as NodeFs from "fs"
import { LinePosition } from '../common/LinePositionedNode'
import { Logger } from '../common/Logging'
import { EelHelperMethod } from '../eel/EelHelperMethod'
import { FlowConfiguration } from './FlowConfiguration'
import { NeosPackageNamespace } from './NeosPackageNamespace'
import { NeosWorkspace } from './NeosWorkspace'
import { ComposerService } from '../common/ComposerService'

export interface EELHelperToken {
	name: string,
	uri: string,
	namespace: NeosPackageNamespace
	pathParts: string[]
	className: string
	package: NeosPackage
	regex: RegExp,
	position: {
		start: LinePosition,
		end: LinePosition
	},
	methods: EelHelperMethod[]
}

interface ComposerJson {
	name: string
	type: string
	autoload?: {
		["psr-4"]?: { [key: string]: string }
	}
	extra?: {
		neos?: {
			["package-key"]: string
		}
	}
}

export class NeosPackage extends Logger {
	public path: string
	public neosWorkspace: NeosWorkspace

	public composerJson: ComposerJson

	public namespaces: Map<string, NeosPackageNamespace> = new Map()
	public configuration!: FlowConfiguration
	protected eelHelpers: EELHelperToken[] = []

	protected debug: boolean

	constructor(path: string, neosWorkspace: NeosWorkspace) {
		const composerJson = ComposerService.getComposerJsonByPath(path)
		super(composerJson.name)

		this.path = NodePath.resolve(neosWorkspace["workspacePath"], path)
		this.neosWorkspace = neosWorkspace

		this.composerJson = composerJson

		this.debug = this.getName() === "neos/fusion"

		this.initNamespaceLoading()
		this.readConfiguration()
	}

	public readConfiguration() {
		this.configuration = FlowConfiguration.ForPackage(this)
	}

	protected initNamespaceLoading() {
		const autoloadNamespaces = this.composerJson?.autoload?.["psr-4"] ?? {}
		const sortedAutoloadNamespaceNames = Object.keys(autoloadNamespaces).sort((a, b) => b.length - a.length)

		for (const namespace of sortedAutoloadNamespaceNames) {
			const namespacePath = autoloadNamespaces[namespace]
			this.namespaces.set(namespace, new NeosPackageNamespace(namespace, NodePath.join(this.path, namespacePath)))
		}
	}

	public initEelHelper() {
		if (this.configuration.settingsConfiguration === null) return undefined

		const defaultNeosFusionContext = this.configuration.get<{ [key: string]: any }>("Neos.Fusion.defaultContext")
		if (!defaultNeosFusionContext) return undefined

		this.logVerbose("Found EEL-Helpers:")
		for (const eelHelperPrefix in defaultNeosFusionContext) {
			const { fqcn, staticMethod } = this.extractFqcnAndStaticMethodFromDefaultContextEntry(<string>defaultNeosFusionContext[eelHelperPrefix])
			const eelHelper = this.neosWorkspace.getEelHelperFromFullyQualifiedClassNameWithStaticMethod(fqcn, staticMethod)
			if (eelHelper !== undefined) {
				const location = {
					name: eelHelperPrefix,
					namespace: eelHelper.namespace,
					pathParts: eelHelper.pathParts,
					className: eelHelper.className,
					package: this,
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
		const match = staticMethodRegex.exec(this.trimLeadingBackslash(path))!
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

	getResourceUriPath(relativePath: string) {
		return NodePath.join(this.path, "Resources", relativePath)
	}

	getTranslationsBasePath() {
		return NodePath.join(this.path, "Resources", "Private", "Translations")
	}

	getEelHelpers() {
		return this.eelHelpers
	}

	getName(): string {
		return this.composerJson.name
	}

	getPackageName() {
		const packageKey = this.composerJson.extra?.neos?.["package-key"]
		return packageKey ?? this.getName().split(/[/-]+/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('.')
	}

	hasName(name: string) {
		// TODO: improve or further implement the concept of "file path based package name"
		if (this.getName() === name) return true
		if (this.getPackageName() === name) return true
		if (this.path.split(NodePath.sep).pop() === name) return true
		return false
	}

	log(...text: any) {
		if (this.debug) console.log("[NeosPackage]", ...text)
	}

	trimLeadingBackslash(fqcn: string) {
		return fqcn.startsWith("\\") ? fqcn.substring(1) : fqcn
	}
}