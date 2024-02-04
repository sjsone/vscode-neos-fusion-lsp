import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { Definition, DefinitionParams, LocationLink, ParameterInformation, SignatureHelp, SignatureHelpParams } from 'vscode-languageserver'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { Logger } from '../common/Logging'
import { FusionFileProcessor } from '../fusion/FusionFileProcessor'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { PhpClassMethodNode } from '../fusion/node/PhpClassMethodNode'
import { PhpClassNode } from '../fusion/node/PhpClassNode'
import { ElementTextDocumentContext } from './ElementContext'
import { ElementFunctionalityInterface, ElementInterface } from './ElementInterface'

export class EelHelperElement extends Logger implements ElementInterface<ObjectFunctionPathNode | PhpClassMethodNode | PhpClassNode> {
	isResponsible(methodName: keyof ElementFunctionalityInterface<AbstractNode>, node: AbstractNode | undefined): boolean {
		if (methodName === "onDefinition") return node instanceof PhpClassMethodNode || node instanceof PhpClassNode
		if (methodName === "onSignatureHelp") return node instanceof ObjectFunctionPathNode && node.parent instanceof ObjectNode
		return false
	}

	async onDefinition(context: ElementTextDocumentContext<DefinitionParams, PhpClassMethodNode | PhpClassNode>): Promise<LocationLink[] | Definition | null | undefined> {
		const node = context.foundNodeByLine!.getNode()
		if (node instanceof PhpClassMethodNode) return this.getEelHelperMethodDefinitions(context.workspace, <LinePositionedNode<PhpClassMethodNode>>context.foundNodeByLine!)
		if (node instanceof PhpClassNode) return this.getEelHelperDefinitions(context.workspace, <LinePositionedNode<PhpClassNode>>context.foundNodeByLine!)
		return null
	}

	protected getEelHelperDefinitions(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<PhpClassNode>) {
		const node = foundNodeByLine.getNode()
		for (const eelHelper of workspace.neosWorkspace.getEelHelperTokens()) {
			if (eelHelper.name === node.identifier) {
				return [{
					uri: eelHelper.uri,
					range: eelHelper.position
				}]
			}
		}

		return null
	}

	protected getEelHelperMethodDefinitions(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<PhpClassMethodNode>) {
		const node = foundNodeByLine.getNode()
		this.logVerbose(`Trying to find ${node.eelHelper.identifier}${node.identifier}`)
		for (const eelHelper of workspace.neosWorkspace.getEelHelperTokens()) {
			if (eelHelper.name === node.eelHelper.identifier) {
				const method = eelHelper.methods.find(method => method.valid(node.identifier))
				if (!method) continue
				return [{
					uri: eelHelper.uri,
					range: method.position
				}]
			}
		}

		return null
	}

	async onSignatureHelp(context: ElementTextDocumentContext<SignatureHelpParams, ObjectFunctionPathNode>): Promise<SignatureHelp | null | undefined> {
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