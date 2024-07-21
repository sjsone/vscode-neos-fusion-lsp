import { CompletionItem, CompletionItemKind, CompletionList, CompletionParams, Definition, DefinitionLink, DefinitionParams, Diagnostic, DiagnosticSeverity, Hover, HoverParams, LocationLink, Position, Range } from 'vscode-languageserver'
import { TranslationShortHandNode } from '../fusion/node/TranslationShortHandNode'
import { ElementTextDocumentContext } from './ElementContext'
import { ElementInterface } from './ElementInterface'
import { XLIFFService } from '../common/XLIFFService'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { LegacyNodeService } from '../common/LegacyNodeService'
import { IgnorableDiagnostic } from '../diagnostics/IgnorableDiagnostic'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ElementHelper } from './ElementHelper'

export class TranslationElement implements ElementInterface<TranslationShortHandNode> {
	isResponsible(methodName: keyof ElementInterface<AbstractNode>, node: AbstractNode | undefined): boolean {
		return node instanceof TranslationShortHandNode
	}

	async onHover(context: ElementTextDocumentContext<HoverParams, TranslationShortHandNode>): Promise<Hover | null | undefined> {
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


	async onCompletion(context: ElementTextDocumentContext<CompletionParams, TranslationShortHandNode>): Promise<CompletionItem[] | CompletionList | null | undefined> {
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
					command: ElementHelper.SuggestCommand
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
					command: ElementHelper.SuggestCommand
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

	async onDefinition(context: ElementTextDocumentContext<DefinitionParams, TranslationShortHandNode>): Promise<LocationLink[] | Definition | null | undefined> {
		const shortHandIdentifier = XLIFFService.readShortHandIdentifier(context.foundNodeByLine!.getNode().getValue())
		const translationFiles = await XLIFFService.getMatchingTranslationFiles(context.workspace, shortHandIdentifier)

		const locations: DefinitionLink[] = []

		for (const translationFile of translationFiles) {
			const transUnit = await translationFile.getId(shortHandIdentifier.translationIdentifier)
			if (!transUnit) continue

			const position = transUnit.position
			const range = Range.create(
				position,
				Position.create(position.line, position.character + transUnit.id.length + 5)
			)

			locations.push({
				targetUri: translationFile.uri,
				targetRange: range,
				targetSelectionRange: range,
				originSelectionRange: context.foundNodeByLine!.getPositionAsRange()
			})

		}
		return locations
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