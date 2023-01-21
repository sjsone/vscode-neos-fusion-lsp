import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode';
import { SymbolKind, WorkspaceSymbol } from 'vscode-languageserver';
import { ParsedFusionFile } from '../fusion/ParsedFusionFile';
import { AbstractCapability } from './AbstractCapability';
import { CapabilityContext, WorkspacesCapabilityContext } from './CapabilityContext';

export class WorkspaceSymbolCapability extends AbstractCapability {
	protected run(context: CapabilityContext<AbstractNode>) {
		const { workspaces } = <WorkspacesCapabilityContext>context

		const symbols: WorkspaceSymbol[] = []
		for (const workspace of workspaces) {
			for (const parsedFile of workspace.parsedFiles) {
				symbols.push(...this.getSymbolsFromParsedFile(parsedFile))
			}
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

		return symbols
	}
}