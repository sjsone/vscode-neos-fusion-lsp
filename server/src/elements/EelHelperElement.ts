import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { Definition, DefinitionParams, Hover, HoverParams, LocationLink, ParameterInformation, SignatureHelp, SignatureHelpParams } from 'vscode-languageserver'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { Logger } from '../common/Logging'
import { FusionFileProcessor } from '../fusion/FusionFileProcessor'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { PhpClassMethodNode } from '../fusion/node/PhpClassMethodNode'
import { PhpClassNode } from '../fusion/node/PhpClassNode'
import { ElementTextDocumentContext } from './ElementContext'
import { ElementFunctionalityInterface, ElementInterface } from './ElementInterface'
import { ElementHelper } from './ElementHelper'

export class EelHelperElement extends Logger implements ElementInterface<ObjectFunctionPathNode | PhpClassMethodNode | PhpClassNode> {
	isResponsible(methodName: keyof ElementFunctionalityInterface<AbstractNode>, node: AbstractNode | undefined): boolean {
		if (methodName === "onDefinition") return node instanceof PhpClassMethodNode || node instanceof PhpClassNode
		if (methodName === "onSignatureHelp") return node instanceof ObjectFunctionPathNode && node.parent instanceof ObjectNode
		if (methodName === "onHover") return node instanceof PhpClassNode || node instanceof ObjectFunctionPathNode || node instanceof PhpClassMethodNode
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

	async onHover(context: ElementTextDocumentContext<HoverParams, AbstractNode>): Promise<Hover | null | undefined> {
		const foundNodeByLine = context.foundNodeByLine!
		const node = foundNodeByLine

		if (node instanceof PhpClassNode)
			return ElementHelper.createHover(`EEL-Helper **${node.identifier}**`, foundNodeByLine)
		if (node instanceof ObjectFunctionPathNode)
			return ElementHelper.createHover(`EEL-Function **${node.value}**`, foundNodeByLine)
		if (node instanceof PhpClassMethodNode)
			return ElementHelper.createHover(this.getMarkdownForEelHelperMethod(<PhpClassMethodNode>node, context.workspace), foundNodeByLine)

		return null
	}

	getMarkdownForEelHelperMethod(node: PhpClassMethodNode, workspace: FusionWorkspace) {
		const header = `EEL-Helper *${node.eelHelper.identifier}*.**${node.identifier}** \n`

		const eelHelper = workspace.neosWorkspace.getEelHelperTokensByName(node.eelHelper.identifier)
		if (eelHelper) {
			const method = eelHelper.methods.find(method => method.valid(node.identifier))
			if (method) {

				const phpParameters = method.parameters.map(p => `${p.type ?? ''}${p.name}${p.defaultValue ?? ''}`).join(", ")

				return [
					header,
					method.description,
					'```php',
					`<?php`,
					`${method.name}(${phpParameters})`,
					'```'
				].join('\n')
			}
		}

		return header
	}
}