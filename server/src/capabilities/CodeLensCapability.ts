import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode';
import { CodeLens } from 'vscode-languageserver';
import { getPrototypeNameFromNode } from '../common/util';
import { AbstractCapability } from './AbstractCapability';
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext';

export class CodeLensCapability extends AbstractCapability {
	protected noPositionedNode: boolean = true

	protected run(context: CapabilityContext) {
		const { workspace, parsedFile } = <ParsedFileCapabilityContext<AbstractNode>>context
		const codeLenses: CodeLens[] = []

		const neosPackage = workspace.neosWorkspace.getPackageByUri(parsedFile.uri)
		if (!neosPackage) return null

		const nodeTypeDefinitions = neosPackage["configuration"]["nodeTypeDefinitions"]
		if (nodeTypeDefinitions.length === 0) return null

		for (const creation of parsedFile.prototypeCreations) {
			const prototypeName = getPrototypeNameFromNode(creation.getNode())
			const nodeTypeDefinition = nodeTypeDefinitions.find(nodeType => nodeType.nodeType === prototypeName)
			if (!nodeTypeDefinition) continue

			const codeLens: CodeLens = {
				range: creation.getPositionAsRange(),
				command: {
					title: "NodeType Definition",
					command: 'vscode.open',
					arguments: [
						nodeTypeDefinition.uri
					]
				}
			}

			codeLenses.push(codeLens)
		}

		return codeLenses
	}
}