import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { CodeLens, CodeLensParams, Position, Range, SymbolInformation, SymbolKind, WorkspaceSymbol, WorkspaceSymbolParams } from 'vscode-languageserver'
import { ElementInterface } from './ElementInterface'
import { NodeTypeService } from '../common/NodeTypeService'
import { ElementTextDocumentContext, ElementWorkspacesContext } from './ElementContext'

export class NodeTypeElement implements ElementInterface {
	isResponsible(methodName: keyof ElementInterface<AbstractNode>, node: AbstractNode | undefined): boolean {
		return true
	}

	async onWorkspaceSymbol(context: ElementWorkspacesContext<WorkspaceSymbolParams>): Promise<SymbolInformation[] | WorkspaceSymbol[] | null | undefined> {
		const { workspaces } = context

		const symbols: WorkspaceSymbol[] = []
		for (const workspace of workspaces) {
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
		}

		return symbols
	}

	async onCodeLens(context: ElementTextDocumentContext<CodeLensParams, AbstractNode>): Promise<CodeLens[] | null | undefined> {
		return NodeTypeService.getNodeTypeDefinitionsFromFusionFile(context.workspace, context.parsedFile!).map(definition => ({
			range: definition.creation.getPositionAsRange(),
			command: {
				title: "NodeType Definition",
				command: 'vscode.open',
				arguments: [
					definition.nodeTypeDefinition.uri
				]
			}
		}))
	}
}