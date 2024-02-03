import { CompletionItem, CompletionItemKind, CompletionList, CompletionParams, Diagnostic, DiagnosticSeverity, Hover, HoverParams } from 'vscode-languageserver'
import { TranslationShortHandNode } from '../fusion/node/TranslationShortHandNode'
import { ElementContext } from './ElementContext'
import { ElementInterface } from './ElementInterface'
import { XLIFFService } from '../common/XLIFFService'
import { CompletionCapability } from '../capabilities/CompletionCapability'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { LegacyNodeService } from '../common/LegacyNodeService'
import { IgnorableDiagnostic } from '../diagnostics/IgnorableDiagnostic'

export class TranslationElement implements ElementInterface<TranslationShortHandNode> {
	async onHover(context: ElementContext<HoverParams, TranslationShortHandNode>): Promise<Hover | null | undefined> {
		const shortHandIdentifier = XLIFFService.readShortHandIdentifier(context.foundNodeByLine!.getNode().getValue())
		const translationFiles = await XLIFFService.getMatchingTranslationFiles(context.workspace, shortHandIdentifier)

		const translationMarkdowns: { isSource: boolean, markdown: string }[] = []
		for (const translationFile of translationFiles) {
			const transUnit = await translationFile.getId(shortHandIdentifier.translationIdentifier)
			if (!transUnit) continue

			const isSource = transUnit.target === undefined
			const position = transUnit.position
			const uri = translationFile.uri + '#L' + (position.line + 1) + ',' + (position.character + 1)

			translationMarkdowns.push({
				isSource,
				markdown: [
					`**[${translationFile.language}](${uri})** ${isSource ? "Source" : ""}`,
					"```\n" + (isSource ? transUnit.source : transUnit.target) + "\n```\n---\n"
				].join("\n")
			})
		}

		translationMarkdowns.sort((a, b) => {
			if (a.isSource && !b.isSource) return -1
			if (!a.isSource && b.isSource) return 1
			return 0
		})

		const markdown = translationMarkdowns.map(translationMarkdowns => translationMarkdowns.markdown).join("\n")

		return {
			contents: { kind: "markdown", value: markdown },
			range: context.foundNodeByLine!.getPositionAsRange()
		}
	}


	async onCompletion(context: ElementContext<CompletionParams, TranslationShortHandNode>): Promise<CompletionItem[] | CompletionList | null | undefined> {
		const node = context.foundNodeByLine!.getNode()

		const shortHandIdentifier = node.getShortHandIdentifier()
		if (!shortHandIdentifier.packageName) {
			const completions = new Map<string, CompletionItem>()
			for (const translationFile of context.workspace.translationFiles) {
				const packageName = translationFile.neosPackage.getPackageName()
				if (!completions.has(packageName)) completions.set(packageName, {
					label: packageName,
					kind: CompletionItemKind.Module,
					insertText: packageName + ':',
					command: CompletionCapability.SuggestCommand
				})
			}
			return Array.from(completions.values())
		}

		const neosPackage = context.workspace.neosWorkspace.getPackage(shortHandIdentifier.packageName)
		if (!neosPackage) return []

		if (!shortHandIdentifier.sourceName) {
			const completions = new Map<string, CompletionItem>()
			for (const translationFile of context.workspace.translationFiles) {
				if (translationFile.neosPackage.getPackageName() !== shortHandIdentifier.packageName) continue
				const source = translationFile.sourceParts.join('.')
				if (!completions.has(source)) completions.set(source, {
					label: source,
					kind: CompletionItemKind.Class,
					insertText: source + ':',
					command: CompletionCapability.SuggestCommand
				})
			}
			return Array.from(completions.values())
		}

		if (!shortHandIdentifier.translationIdentifier) {
			const completions = new Map<string, CompletionItem>()
			for (const translationFile of context.workspace.translationFiles) {
				if (translationFile.neosPackage.getPackageName() !== shortHandIdentifier.packageName) continue
				if (translationFile.sourceParts.join('.') !== shortHandIdentifier.sourceName) continue
				for (const transUnit of translationFile.transUnits.values()) {
					if (!completions.has(transUnit.id)) completions.set(transUnit.id, {
						label: transUnit.id,
						kind: CompletionItemKind.Class,
						insertText: transUnit.id,
					})
				}
			}
			return Array.from(completions.values())
		}

		return []
	}

	async diagnose(parsedFusionFile: ParsedFusionFile): Promise<Diagnostic[] | null | undefined> {
		const diagnostics: Diagnostic[] = []
		const workspace = parsedFusionFile.neosPackage.neosWorkspace.fusionWorkspace
		const translationShortHandNodes = parsedFusionFile.getNodesByType(TranslationShortHandNode)
		if (translationShortHandNodes === undefined) return diagnostics

		for (const translationShortHandNode of translationShortHandNodes) {
			const node = translationShortHandNode.getNode()
			const identifier = XLIFFService.readShortHandIdentifier(node.getValue())
			const translationFiles = await XLIFFService.getMatchingTranslationFiles(workspace, identifier)
			if (translationFiles.length > 0) continue

			if (LegacyNodeService.isNodeAffectedByIgnoreComment(node, parsedFusionFile)) continue

			diagnostics.push(IgnorableDiagnostic.create(translationShortHandNode.getPositionAsRange(), `Unknown Translation ID ${node.getValue()}`, DiagnosticSeverity.Error))
		}

		return diagnostics
	}
}