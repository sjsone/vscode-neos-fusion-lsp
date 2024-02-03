import * as NodePath from 'path';
import { CompletionItem, CompletionItemKind, CompletionList, CompletionParams, Definition, DefinitionParams, Hover, HoverParams, LocationLink, Position } from 'vscode-languageserver';
import * as YAML from 'yaml';
import { CompletionCapability } from '../capabilities/CompletionCapability';
import { Logger } from '../common/Logging';
import { FlowConfigurationPathPartNode } from '../fusion/FlowConfigurationPathPartNode';
import { ElementContext } from './ElementContext';
import { ElementHelper } from './ElementHelper';
import { ElementInterface } from './ElementInterface';

export class FlowConfigurationElement extends Logger implements ElementInterface<FlowConfigurationPathPartNode>  {
	async onCompletion(context: ElementContext<CompletionParams, FlowConfigurationPathPartNode>): Promise<CompletionItem[] | CompletionList | null | undefined> {
		const partNode = context.foundNodeByLine!

		const completions: CompletionItem[] = []
		const node = partNode.getNode()["parent"]
		const partIndex = node["path"].indexOf(partNode.getNode())
		if (partIndex === -1) return []

		const pathParts = node["path"].slice(0, partIndex + 1)
		const searchPath = pathParts.map(part => part["value"]).filter(Boolean)
		this.logDebug("searching for ", searchPath)

		for (const neosPackage of context.workspace.neosWorkspace.getPackages().values()) {
			for (const result of neosPackage["configuration"].search(searchPath)) {
				if (typeof result.value === "string") {
					completions.push(ElementHelper.createCompletionItem(result.value, partNode, CompletionItemKind.Text))
				}

				if (typeof result.value === "object") {
					for (const itemName in result.value) {
						const value = result.value[itemName]
						const isObject = typeof value === "object"

						const label = (searchPath.length > 0 ? '.' : '') + itemName + (isObject ? '.' : '')
						if (completions.find(completion => completion.label === label)) continue

						let type: CompletionItemKind = CompletionItemKind.Value
						if (typeof value === "string") type = CompletionItemKind.Text
						if (isObject) type = CompletionItemKind.Class

						const completion = ElementHelper.createCompletionItem(label, partNode, type)
						completion.command = CompletionCapability.SuggestCommand
						completions.push(completion)
					}
				}
			}
		}

		return completions
	}

	async onHover(context: ElementContext<HoverParams, FlowConfigurationPathPartNode>): Promise<Hover | null | undefined> {
		const partNode = context.foundNodeByLine!.getNode()
		const node = partNode["parent"]

		const partIndex = node["path"].indexOf(partNode)
		if (partIndex === -1) return null

		const pathParts = node["path"].slice(0, partIndex + 1)
		const searchPath = pathParts.map(part => part["value"]).join(".")
		this.logDebug("searching for ", searchPath)

		const results: string[] = []
		for (const result of context.workspace.neosWorkspace["configurationManager"].search(searchPath)) {
			const fileUri = result.file["uri"]
			const neosPackage = context.workspace.neosWorkspace.getPackageByUri(fileUri)
			const packageName = neosPackage?.getPackageName() ?? 'Project Configuration'
			results.push(`# [${packageName}] ${NodePath.basename(fileUri)}`)
			results.push(YAML.stringify(result.value, undefined, 3))
		}
		if (results.length === 0) return ElementHelper.createHover(`_no value found_`, context.foundNodeByLine!)

		const markdown = [
			"```yaml",
			...results,
			"```"
		].join("\n")

		return ElementHelper.createHover(markdown, context.foundNodeByLine!)
	}

	async onDefinition(context: ElementContext<DefinitionParams, FlowConfigurationPathPartNode>): Promise<LocationLink[] | Definition | null | undefined> {
		const partNode = context.foundNodeByLine!.getNode()
		const node = partNode["parent"]

		const partIndex = node["path"].indexOf(partNode)
		if (partIndex === -1) return []

		const pathParts = node["path"].slice(0, partIndex + 1)
		const searchPath = pathParts.map(part => part["value"]).join(".")
		this.logDebug("searching for ", searchPath)

		const nodeBegin = node.linePositionedNode.getBegin()
		const originSelectionRange = {
			start: Position.create(nodeBegin.line, nodeBegin.character + 1),
			end: context.foundNodeByLine!.getEnd()
		}

		// console.log("test", workspace.neosWorkspace.configurationManager.getMerged("Neos.Flow.core"))

		const locationLinks: LocationLink[] = []
		for (const result of context.workspace.neosWorkspace.configurationManager.search(searchPath)) {
			locationLinks.push({
				targetUri: result.file["uri"],
				targetRange: result.range,
				targetSelectionRange: result.range,
				originSelectionRange
			})
		}
		return locationLinks
	}

}