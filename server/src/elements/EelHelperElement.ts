import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { Definition, DefinitionParams, Hover, HoverParams, InlayHint, InlayHintKind, InlayHintParams, LocationLink, MarkupKind, ParameterInformation, SignatureHelp, SignatureHelpParams } from 'vscode-languageserver'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { Logger } from '../common/Logging'
import { FusionFileProcessor } from '../fusion/FusionFileProcessor'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { PhpClassMethodNode } from '../fusion/node/PhpClassMethodNode'
import { PhpClassNode } from '../fusion/node/PhpClassNode'
import { ElementTextDocumentContext } from './ElementContext'
import { ElementHelper } from './ElementHelper'
import { ElementInterface, ElementMethod } from './ElementInterface'
import { AbstractLiteralNode } from 'ts-fusion-parser/out/dsl/eel/nodes/AbstractLiteralNode'
import { LiteralArrayNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralArrayNode'
import { LiteralNullNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralNullNode'
import { LiteralNumberNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralNumberNode'
import { LiteralObjectEntryNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralObjectEntryNode'
import { LiteralObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralObjectNode'
import { LiteralStringNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode'
import { InlayHintDepth } from '../ExtensionConfiguration'
import { EelHelperMethod } from '../eel/EelHelperMethod'

export class EelHelperElement extends Logger implements ElementInterface<ObjectFunctionPathNode | PhpClassMethodNode | PhpClassNode> {
	isResponsible(methodName: ElementMethod, node: AbstractNode | undefined): boolean {
		if (methodName === "onDefinition") return node instanceof PhpClassMethodNode || node instanceof PhpClassNode
		if (methodName === "onSignatureHelp") return node instanceof ObjectFunctionPathNode && node.parent instanceof ObjectNode
		if (methodName === "onHover") return node instanceof PhpClassNode || node instanceof ObjectFunctionPathNode || node instanceof PhpClassMethodNode
		if (methodName === "onInlayHint") return true
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

	async onInlayHint(context: ElementTextDocumentContext<InlayHintParams, ObjectFunctionPathNode | PhpClassMethodNode | PhpClassNode>): Promise<InlayHint[] | null | undefined> {
		// 		if (workspace.getConfiguration().inlayHint.depth === InlayHintDepth.Disabled) return null
		const phpMethodNodes = context.parsedFile.getNodesByType(PhpClassMethodNode)
		if (!phpMethodNodes) return []

		const inlayHints: InlayHint[] = []
		for (const phpMethodNode of phpMethodNodes) {
			const node = phpMethodNode.getNode()
			const eelHelper = context.workspace.neosWorkspace.getEelHelperTokensByName(node.eelHelper.identifier)
			if (!eelHelper) continue

			const method = eelHelper.methods.find(method => method.valid(node.identifier))
			if (!method) continue
			if (!(node.pathNode instanceof ObjectFunctionPathNode)) continue

			for (const hint of this.getInlayHintsFromPhpClassMethodNode(node, method, context.workspace)) {
				inlayHints.push(hint)
			}
		}

		return inlayHints
	}


	protected * getInlayHintsFromPhpClassMethodNode(node: PhpClassMethodNode, method: EelHelperMethod, workspace: FusionWorkspace) {
		if (!(node.pathNode instanceof ObjectFunctionPathNode)) return

		// TODO: improve spread parameter label 
		let spreadParameterIndex: undefined | number = undefined
		for (const index in node.pathNode.args) {
			const arg = node.pathNode.args[index]
			if (!this.canShowInlayHintForArgumentNode(workspace, arg)) continue

			let parameter = method.parameters[index]
			if (!parameter && spreadParameterIndex === undefined) continue
			if (parameter?.spread) {
				spreadParameterIndex = parseInt(index)
			} else if (spreadParameterIndex !== undefined) {
				parameter = method.parameters[spreadParameterIndex]
			}

			const linePositionedArg = arg.linePositionedNode
			const isSpread = parameter.spread
			const spreadOffset = isSpread ? parseInt(index) - spreadParameterIndex! : 0
			const showParameterName = !isSpread || spreadOffset < 1
			const parameterName = parameter.name.replace("$", "")

			const labelPrefix = isSpread ? '...' : ''
			const label = showParameterName ? parameterName : ''
			const labelSuffix = isSpread ? `[${spreadOffset}]` : ''
			yield {
				label: `${labelPrefix}${label}${labelSuffix}:`,
				kind: InlayHintKind.Parameter,
				tooltip: {
					kind: MarkupKind.Markdown,
					value: [
						"```php",
						`<?php`,
						`${parameter.type ?? ""}${parameter.name}${parameter.defaultValue ?? ""}`,
						"```"
					].join("\n")
				},
				paddingRight: true,
				position: linePositionedArg.getBegin()
			} as InlayHint
		}
	}

	protected canShowInlayHintForArgumentNode(workspace: FusionWorkspace, argumentNode: AbstractNode) {
		if (workspace.getConfiguration().inlayHint.depth === InlayHintDepth.Always) return true

		// TODO: if the node is an Operation and the first operand is and AbstractLiteralNode it should be shown as well
		// TODO: it should be just `AbstractLiteralNode` once "ts-fusion-parser" is updated
		return argumentNode instanceof AbstractLiteralNode
			|| argumentNode instanceof LiteralObjectNode
			|| argumentNode instanceof LiteralArrayNode
			|| argumentNode instanceof LiteralNumberNode
			|| argumentNode instanceof LiteralStringNode
			|| argumentNode instanceof LiteralNullNode
			|| argumentNode instanceof LiteralObjectEntryNode
	}
}