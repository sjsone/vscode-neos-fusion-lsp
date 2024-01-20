import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { CodeLens } from 'vscode-languageserver'
import { NodeTypeService } from '../common/NodeTypeService'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext'

export class CodeLensCapability extends AbstractCapability {
	protected noPositionedNode = true

	protected run(context: CapabilityContext) {
		const codeLenses: CodeLens[] = []
		const { workspace, parsedFile } = <ParsedFileCapabilityContext<AbstractNode>>context

		codeLenses.push(...this.getCodeLensesForNodeTypeDefinition(workspace, parsedFile))

		return codeLenses
	}

	protected getCodeLensesForNodeTypeDefinition(workspace: FusionWorkspace, parsedFile: ParsedFusionFile) {
		return NodeTypeService.getNodeTypeDefinitionsFromFusionFile(workspace, parsedFile).map(definition => ({
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