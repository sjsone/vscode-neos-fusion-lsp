import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { CodeLens, CodeLensParams } from 'vscode-languageserver'
import { ElementInterface } from './ElementInterface'
import { NodeTypeService } from '../common/NodeTypeService'
import { ElementTextDocumentContext } from './ElementContext'

export class NodeTypeElement implements ElementInterface {
	isResponsible(methodName: keyof ElementInterface<AbstractNode>, node: AbstractNode | undefined): boolean {
		return true
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