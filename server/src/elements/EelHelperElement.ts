import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ParameterInformation, SignatureHelp, SignatureHelpParams } from 'vscode-languageserver'
import { FusionFileProcessor } from '../fusion/FusionFileProcessor'
import { ElementContext } from './ElementContext'
import { ElementFunctionalityInterface, ElementInterface } from './ElementInterface'

export class EelHelperElement implements ElementInterface<ObjectFunctionPathNode> {
	isResponsible(methodName: keyof ElementFunctionalityInterface<AbstractNode>, node: AbstractNode | undefined): boolean {
		return node instanceof ObjectFunctionPathNode && node.parent instanceof ObjectNode
	}

	async onSignatureHelp(context: ElementContext<SignatureHelpParams, ObjectFunctionPathNode>): Promise<SignatureHelp | null | undefined> {
		const node = context.foundNodeByLine!.getNode()

		const signatureHelp: SignatureHelp = {
			signatures: [],
			activeSignature: undefined,
			activeParameter: undefined
		}

		for (const {
			method,
			eelHelperNode,
			eelHelperMethodNode,
		} of FusionFileProcessor.ResolveEelHelpersForObjectNode(<ObjectNode>node.parent!, context.workspace.neosWorkspace)) {
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