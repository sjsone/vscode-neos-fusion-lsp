import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { CodeLens, CodeLensParams } from 'vscode-languageserver'
import { ElementInterface } from './ElementInterface'
import { NodeTypeService } from '../common/NodeTypeService'
import { ElementContext } from './ElementContext'

export class NodeTypeElement implements ElementInterface {
	async onCodeLens(context: ElementContext<CodeLensParams, AbstractNode>): Promise<CodeLens[] | null | undefined> {
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