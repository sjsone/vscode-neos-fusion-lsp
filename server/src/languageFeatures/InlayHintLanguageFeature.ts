import { InlayHint, InlayHintKind, MarkupKind } from 'vscode-languageserver/node';
import { PhpClassMethodNode } from '../fusion/PhpClassMethodNode';
import { AbstractLanguageFeature } from './AbstractLanguageFeature';
import { LanguageFeatureContext } from './LanguageFeatureContext';
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode';
import { LiteralObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralObjectNode';
import { LiteralArrayNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralArrayNode';
import { AbstractLiteralNode } from 'ts-fusion-parser/out/dsl/eel/nodes/AbstractLiteralNode';
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode';
import { InlayHintDepth } from '../ExtensionConfiguration';
import { FusionWorkspace } from '../fusion/FusionWorkspace';
import { EelHelperMethod } from '../eel/EelHelperMethod';
import { LiteralNumberNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralNumberNode';
import { LiteralStringNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode';
import { LiteralNullNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralNullNode';
import { LiteralObjectEntryNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralObjectEntryNode';
import { ParsedFusionFile } from '../fusion/ParsedFusionFile';

export class InlayHintLanguageFeature extends AbstractLanguageFeature {

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

		for (const index in node.pathNode.args) {
			const arg = node.pathNode.args[index]
			if (!this.canShowInlayHintForArgumentNode(workspace, arg)) continue

			const parameter = method.parameters[index]
			if (!parameter) continue

			const linePositionedArg = arg.linePositionedNode

			yield {
				label: parameter.name.replace("$", "") + ':',
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