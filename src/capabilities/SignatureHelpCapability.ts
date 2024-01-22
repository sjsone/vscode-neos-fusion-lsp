import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ParameterInformation, SignatureHelp, SignatureHelpParams } from 'vscode-languageserver'
import { FusionFileProcessor } from '../fusion/FusionFileProcessor'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext'

export class SignatureHelpCapability extends AbstractCapability {

	protected run(context: CapabilityContext): SignatureHelp | undefined | null {
		const { workspace, parsedFile, foundNodeByLine } = <ParsedFileCapabilityContext<AbstractNode>>context
		const node = foundNodeByLine?.getNode()

		if (!(node instanceof ObjectFunctionPathNode)) return undefined
		if (!(node.parent instanceof ObjectNode)) return undefined

		const signatureHelp: SignatureHelp = {
			signatures: [],
			activeSignature: undefined,
			activeParameter: undefined
		}

		for (const {
			method,
			eelHelperNode,
			eelHelperMethodNode,
		} of FusionFileProcessor.ResolveEelHelpersForObjectNode(node.parent, workspace.neosWorkspace)) {
			const parameters: ParameterInformation[] = []
			for (const parameter of method.parameters) {
				const name = parameter.name.replace("$", "")
				parameters.push({
					label: name,
					documentation: `${parameter.type ?? ''}${name}`
				})
			}

			const signatureLabelIdentifier = `${eelHelperNode.identifier}.${eelHelperMethodNode.identifier}`
			const signatureLabelParameters = parameters.map(p => p.documentation).join(', ')
			signatureHelp.signatures.push({
				label: `${signatureLabelIdentifier}(${signatureLabelParameters})`,
				documentation: method.description,
				parameters
			})
		}

		return signatureHelp
	}
}