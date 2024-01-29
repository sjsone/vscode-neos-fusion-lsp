import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { Position, Range, SymbolKind, WorkspaceSymbol } from 'vscode-languageserver'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext, WorkspacesCapabilityContext } from './CapabilityContext'

export class WorkspaceSymbolCapability extends AbstractCapability {
	protected run(context: CapabilityContext<AbstractNode>) {
		const { workspaces } = <WorkspacesCapabilityContext>context

		const symbols: WorkspaceSymbol[] = []
		for (const workspace of workspaces) {
			for (const parsedFile of workspace.parsedFiles) {
				symbols.push(...this.getSymbolsFromParsedFile(parsedFile))
			}
			// TODO: Make NodeTypes WorkspaceSymbols configurable in settings
			symbols.push(...this.getSymbolsFromNodeTypes(workspace))
		}

		return symbols
	}

	protected getSymbolsFromParsedFile(parsedFile: ParsedFusionFile): WorkspaceSymbol[] {
		const symbols: WorkspaceSymbol[] = []

		// TODO: concept which workspace symbols should be shown
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

		return symbols
	}

	protected getSymbolsFromNodeTypes(workspace: FusionWorkspace): WorkspaceSymbol[] {
		const symbols: WorkspaceSymbol[] = []

		for (const neosPackage of workspace.neosWorkspace.getPackages().values()) {
			const nodeTypeDefinitions = neosPackage.configuration.nodeTypeDefinitions
			if (!nodeTypeDefinitions) continue
			for (const nodeTypeDefinition of nodeTypeDefinitions) {
				symbols.push({
					name: `NodeType: ${nodeTypeDefinition.nodeType} [${neosPackage?.getPackageName()}]`,
					location: { uri: nodeTypeDefinition.uri, range: Range.create(Position.create(0, 0), Position.create(0, 0)) },
					kind: SymbolKind.Struct,
				})
			}
		}

		return symbols
	}
}