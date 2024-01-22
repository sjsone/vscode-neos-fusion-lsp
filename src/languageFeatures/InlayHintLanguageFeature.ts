import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { AbstractLiteralNode } from 'ts-fusion-parser/out/dsl/eel/nodes/AbstractLiteralNode'
import { LiteralArrayNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralArrayNode'
import { LiteralNullNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralNullNode'
import { LiteralNumberNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralNumberNode'
import { LiteralObjectEntryNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralObjectEntryNode'
import { LiteralObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralObjectNode'
import { LiteralStringNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { InlayHint, InlayHintKind, InlayHintParams, MarkupKind } from 'vscode-languageserver/node'
import { InlayHintDepth } from '../ExtensionConfiguration'
import { EelHelperMethod } from '../eel/EelHelperMethod'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { PhpClassMethodNode } from '../fusion/node/PhpClassMethodNode'
import { AbstractLanguageFeature } from './AbstractLanguageFeature'
import { LanguageFeatureContext } from './LanguageFeatureContext'

export class InlayHintLanguageFeature extends AbstractLanguageFeature<InlayHintParams> {

	protected run({ parsedFile, workspace }: LanguageFeatureContext) {
		if (workspace.getConfiguration().inlayHint.depth === InlayHintDepth.Disabled) return null

		return [
			...this.buildInlineHintForPhpClassMethodNodes(parsedFile, workspace)
		]
	}

	protected buildInlineHintForPhpClassMethodNodes(parsedFile: ParsedFusionFile, workspace: FusionWorkspace): InlayHint[] {
		const phpMethodNodes = parsedFile.getNodesByType(PhpClassMethodNode)
		if (!phpMethodNodes) return []

		const inlayHints: InlayHint[] = []
		for (const phpMethodNode of phpMethodNodes) {
			const node = phpMethodNode.getNode()
			const eelHelper = workspace.neosWorkspace.getEelHelperTokensByName(node.eelHelper.identifier)
			if (!eelHelper) continue

			const method = eelHelper.methods.find(method => method.valid(node.identifier))
			if (!method) continue
			if (!(node.pathNode instanceof ObjectFunctionPathNode)) continue

			for (const hint of this.getInlayHintsFromPhpClassMethodNode(node, method, workspace)) {
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