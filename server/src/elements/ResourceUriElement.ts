import * as NodeFs from 'fs'
import * as NodePath from 'path'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { CompletionItem, CompletionItemKind, CompletionList, CompletionParams, Definition, DefinitionParams, Hover, HoverParams, LocationLink } from 'vscode-languageserver'
import { Logger } from '../common/Logging'
import { pathToUri } from '../common/util'
import { ResourceUriNode } from '../fusion/node/ResourceUriNode'
import { NeosPackage } from '../neos/NeosPackage'
import { ElementTextDocumentContext } from './ElementContext'
import { ElementHelper } from './ElementHelper'
import { ElementInterface } from './ElementInterface'

export class ResourceUriElement extends Logger implements ElementInterface<ResourceUriNode> {
	isResponsible(methodName: keyof ElementInterface<AbstractNode>, node: AbstractNode | undefined): boolean {
		return node instanceof ResourceUriNode
	}

	async onDefinition(context: ElementTextDocumentContext<DefinitionParams, ResourceUriNode>): Promise<LocationLink[] | Definition | null | undefined> {
		const node = context.foundNodeByLine!.getNode()
		if (!node.canBeFound()) {
			this.logDebug("ResourceURI cannot be found")
			return null
		}
		const path = context.workspace.neosWorkspace.getResourceUriPath(node.getNamespace(), node.getRelativePath())
		if (!path || !NodeFs.existsSync(path)) {
			this.logDebug(`Resource path path is "${path}" with node.namespace "${node.getNamespace()}" and node.relativePath "${node.getRelativePath()}"`)
			return null
		}

		const targetRange = {
			start: { line: 0, character: 0 },
			end: { line: 0, character: 0 },
		}

		const uri = pathToUri(path)
		this.logDebug(`Resource path path is "${path}" and uri is "${uri}"`)

		return [{
			targetUri: uri,
			targetRange: targetRange,
			targetSelectionRange: targetRange,
			originSelectionRange: context.foundNodeByLine!.getPositionAsRange()
		}]
	}

	async onCompletion(context: ElementTextDocumentContext<CompletionParams, ResourceUriNode>): Promise<CompletionItem[] | CompletionList | null | undefined> {
		const node = context.foundNodeByLine!.getNode()

		const identifierMatch = /resource:\/\/(.*?)\//.exec(node.identifier)
		if (identifierMatch === null) {
			const completions = []
			for (const neosPackage of context.workspace.neosWorkspace.getPackages().values()) {
				const packageName = neosPackage.getPackageName()
				if (!packageName) continue

				completions.push({
					label: packageName,
					kind: CompletionItemKind.Module,
					insertText: packageName + '/',
					command: ElementHelper.SuggestCommand
				})
			}
			return completions
		}

		const packageName = identifierMatch[1]

		const neosPackage = context.workspace.neosWorkspace.getPackage(packageName)
		if (!neosPackage) return []

		const nextPath = NodePath.join(neosPackage.path, "Resources", node.getRelativePath())
		if (!NodeFs.existsSync(nextPath)) return []

		const completions: CompletionItem[] = []
		const thingsInFolder = NodeFs.readdirSync(nextPath, { withFileTypes: true })
		for (const thing of thingsInFolder) {
			if (thing.isFile()) completions.push({
				label: thing.name,
				kind: CompletionItemKind.File,
				insertText: thing.name,
			})

			if (thing.isDirectory()) completions.push({
				label: thing.name,
				kind: CompletionItemKind.Folder,
				insertText: thing.name + '/',
				command: ElementHelper.SuggestCommand
			})
		}

		return completions
	}

	async onHover(context: ElementTextDocumentContext<HoverParams, ResourceUriNode>): Promise<Hover | null | undefined> {
		const node = context.foundNodeByLine!.getNode()

		if (!node.canBeFound()) return null
		const path = context.workspace.neosWorkspace.getResourceUriPath(node.getNamespace(), node.getRelativePath())
		if (!path || !NodeFs.existsSync(path)) return ElementHelper.createHover(`**Could not find Resource**`, context.foundNodeByLine!)

		const basename = NodePath.basename(path)
		const isImage = (/\.(gif|jpe?g|tiff?|png|webp|bmp|svg|ico|icns)$/i).test(basename)

		if (isImage) return ElementHelper.createHover(`![${basename}](${path})`, context.foundNodeByLine!)
		return ElementHelper.createHover(`Resource: ${basename}`, context.foundNodeByLine!)
	}
}