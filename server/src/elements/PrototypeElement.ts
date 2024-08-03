import * as NodePath from 'path'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { CompletionItem, CompletionItemKind, CompletionList, CompletionParams, Definition, DefinitionLink, DefinitionParams, Hover, HoverParams, Location, LocationLink, ReferenceParams, SymbolInformation, SymbolKind, WorkspaceSymbol, WorkspaceSymbolParams } from 'vscode-languageserver'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { Logger } from '../common/Logging'
import { abstractNodeToString, findParent, getPrototypeNameFromNode } from '../common/util'
import { ElementTextDocumentContext, ElementWorkspacesContext } from './ElementContext'
import { ElementHelper } from './ElementHelper'
import { ElementInterface } from './ElementInterface'
import { PropertyDocumentationDefinition } from 'ts-fusion-parser/out/fusion/nodes/PropertyDocumentationDefinition'

export class PrototypeElement extends Logger implements ElementInterface<FusionObjectValue | PrototypePathSegment> {
	isResponsible(methodName: keyof ElementInterface<AbstractNode>, node: AbstractNode | undefined): boolean {
		return node instanceof FusionObjectValue || node instanceof PrototypePathSegment
	}

	async onWorkspaceSymbol(context: ElementWorkspacesContext<WorkspaceSymbolParams>): Promise<SymbolInformation[] | WorkspaceSymbol[] | null | undefined> {
		const { workspaces } = context

		const symbols: WorkspaceSymbol[] = []
		for (const workspace of workspaces) {
			for (const parsedFile of workspace.parsedFiles) {
				for (const prototypePathSegment of parsedFile.prototypeCreations) {
					const node = prototypePathSegment.getNode()

					symbols.push({
						name: node.identifier,
						location: { uri: parsedFile.uri, range: prototypePathSegment.getPositionAsRange() },
						kind: SymbolKind.Class,
					})
				}

				const neosPackage = parsedFile.workspace.neosWorkspace.getPackageByUri(parsedFile.uri)
				for (const prototypePathSegment of parsedFile.prototypeOverwrites) {
					const node = prototypePathSegment.getNode()

					symbols.push({
						name: `${node.identifier} [${neosPackage?.getPackageName()}]`,
						location: { uri: parsedFile.uri, range: prototypePathSegment.getPositionAsRange() },
						kind: SymbolKind.Constructor,
					})
				}
			}
		}

		return symbols
	}

	async onCompletion(context: ElementTextDocumentContext<CompletionParams, any>): Promise<CompletionItem[] | CompletionList | null | undefined> {
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

	async onDefinition(context: ElementTextDocumentContext<DefinitionParams, FusionObjectValue | PrototypePathSegment>): Promise<LocationLink[] | Definition | null | undefined> {
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

	async onHover(context: ElementTextDocumentContext<HoverParams, FusionObjectValue | PrototypePathSegment>): Promise<Hover | null | undefined> {
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

		for (const statement of otherObjectStatement.block.statementList.statements) {
			if (statement instanceof ObjectStatement) {
				let statementName = statement.path.segments.map(abstractNodeToString).filter(Boolean).join(".")
				if (statement.operation instanceof ValueAssignment) {
					statementName += ` = ${abstractNodeToString(statement.operation.pathValue)}`
				}
				yield statementName
				continue
			}
			if (statement instanceof PropertyDocumentationDefinition) {
				yield `/// ${statement.type} ${statement.text}`
			}
		}
	}

	async onReferences(context: ElementTextDocumentContext<ReferenceParams, AbstractNode>): Promise<Location[] | null | undefined> {
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