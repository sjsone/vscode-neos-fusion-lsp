import * as NodePath from 'path'
import { CompletionParams, CompletionItem, CompletionList, CompletionItemKind, Definition, DefinitionParams, LocationLink, DefinitionLink, DocumentSymbol, DocumentSymbolParams, SymbolInformation, Hover, HoverParams, Location, ReferenceParams } from 'vscode-languageserver';
import { Logger } from '../common/Logging';
import { ElementContext } from './ElementContext';
import { ElementInterface } from './ElementInterface';
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue';
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment';
import { ElementHelper } from './ElementHelper';
import { abstractNodeToString, findParent, getPrototypeNameFromNode } from '../common/util';
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement';
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment';
import { LinePositionedNode } from '../common/LinePositionedNode';
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode';

export class PrototypeElement extends Logger implements ElementInterface<FusionObjectValue | PrototypePathSegment> {
	async onCompletion(context: ElementContext<CompletionParams, any>): Promise<CompletionItem[] | CompletionList | null | undefined> {
		const completions: CompletionItem[] = []

		const foundNodes = context.workspace.getNodesByType(PrototypePathSegment)
		if (!foundNodes) return []

		for (const fileNodes of foundNodes) {
			for (const fileNode of fileNodes.nodes) {
				const label = fileNode.getNode().identifier
				if (!completions.find(completion => completion.label === label)) {
					completions.push(ElementHelper.createCompletionItem(label, context.foundNodeByLine!, CompletionItemKind.Class))
				}
			}
		}

		return completions
	}

	async onDefinition(context: ElementContext<DefinitionParams, FusionObjectValue | PrototypePathSegment>): Promise<LocationLink[] | Definition | null | undefined> {
		const goToPrototypeName = getPrototypeNameFromNode(context.foundNodeByLine!.getNode())
		if (goToPrototypeName === "") {
			this.logDebug("No PrototypeName found for this node")
			return null
		}

		const locations: DefinitionLink[] = []

		for (const otherParsedFile of context.workspace.parsedFiles) {
			for (const otherNode of [...otherParsedFile.prototypeCreations, ...otherParsedFile.prototypeOverwrites]) {
				if (otherNode.getNode().identifier !== goToPrototypeName) continue
				locations.push({
					targetUri: otherParsedFile.uri,
					targetRange: otherNode.getPositionAsRange(),
					targetSelectionRange: otherNode.getPositionAsRange(),
					originSelectionRange: context.foundNodeByLine!.getPositionAsRange()
				})
			}
		}

		return locations
	}

	async onHover(context: ElementContext<HoverParams, FusionObjectValue | PrototypePathSegment>): Promise<Hover | null | undefined> {
		const prototypeName = getPrototypeNameFromNode(context.foundNodeByLine!.getNode())
		if (prototypeName === null) return null

		const statementsNames: string[] = []
		for (const otherParsedFile of context.workspace.parsedFiles) {
			const statementsNamesFromFile: string[] = []
			for (const otherPositionedNode of [...otherParsedFile.prototypeCreations, ...otherParsedFile.prototypeOverwrites]) {
				for (const statementName of this.createStatementNamesFromPrototypeNode(prototypeName, otherPositionedNode)) {
					statementsNamesFromFile.push(statementName)
				}
			}
			if (statementsNamesFromFile.length === 0) continue

			const packageName = context.workspace.neosWorkspace.getPackageByUri(otherParsedFile.uri)?.getPackageName() ?? 'unknown package'
			statementsNames.push(`// [${packageName}] ${NodePath.basename(otherParsedFile.uri)}`)
			statementsNames.push(...statementsNamesFromFile)
		}

		const statementsNamesMarkdown = statementsNames.length > 0 ? "\n" + statementsNames.map(name => `  ${name}`).join("\n") + "\n" : " "
		return ElementHelper.createHover([
			"```",
			`prototype(${prototypeName}) {${statementsNamesMarkdown}}`,
			"```"
		].join("\n"), context.foundNodeByLine!)
	}

	protected * createStatementNamesFromPrototypeNode(prototypeName: string, positionedPrototypeNode: LinePositionedNode<PrototypePathSegment>) {
		const prototypeNode = positionedPrototypeNode.getNode()
		if (prototypeNode.identifier !== prototypeName) return

		const otherObjectStatement = findParent(prototypeNode, ObjectStatement)
		if (!otherObjectStatement?.block) return

		for (const statement of <ObjectStatement[]>otherObjectStatement.block.statementList.statements) {
			let statementName = statement.path.segments.map(abstractNodeToString).filter(Boolean).join(".")
			if (statement.operation instanceof ValueAssignment) {
				statementName += ` = ${abstractNodeToString(statement.operation.pathValue)}`
			}
			yield statementName
		}
	}

	async onReferences(context: ElementContext<ReferenceParams, AbstractNode>): Promise<Location[] | null | undefined> {
		const node = context.foundNodeByLine!.getNode()
		const prototypeName = getPrototypeNameFromNode(node)
		if (prototypeName!) return null

		this.logDebug(`prototypeName "${prototypeName}"`)

		const locations: Location[] = []

		for (const otherParsedFile of context.workspace.parsedFiles) {
			for (const nodeType of [PrototypePathSegment, FusionObjectValue]) {
				const otherNodes = otherParsedFile.getNodesByType(<any>nodeType) ?? []
				for (const otherNode of otherNodes) {
					if (getPrototypeNameFromNode(otherNode.getNode()) !== prototypeName) continue
					locations.push({
						uri: otherParsedFile.uri,
						range: otherNode.getPositionAsRange()
					})
				}
			}
		}

		return locations
	}

}