import { InlayHint, InlayHintKind, MarkupKind } from 'vscode-languageserver/node';
import { PhpClassMethodNode } from '../fusion/PhpClassMethodNode';
import { AbstractLanguageFeature } from './AbstractLanguageFeature';
import { LanguageFeatureContext } from './LanguageFeatureContext';
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/eel/nodes/ObjectFunctionPathNode';
import { LinePositionedNode } from '../LinePositionedNode';
import { LiteralObjectNode } from 'ts-fusion-parser/out/eel/nodes/LiteralObjectNode';
import { LiteralArrayNode } from 'ts-fusion-parser/out/eel/nodes/LiteralArrayNode';
import { AbstractLiteralNode } from 'ts-fusion-parser/out/eel/nodes/AbstractLiteralNode';
import { AbstractNode } from 'ts-fusion-parser/out/afx/nodes/AbstractNode';
import { InlayHintDepth } from '../ExtensionConfiguration';
import { FusionWorkspace } from '../fusion/FusionWorkspace';

export class InlayHintLanguageFeature extends AbstractLanguageFeature {

	protected run({ parsedFile, workspace }: LanguageFeatureContext) {
		if (workspace.getConfiguration().inlayHint.depth === InlayHintDepth.Disabled) return null

		const inlayHints: InlayHint[] = []
		const phpMethodNodes = parsedFile.getNodesByType(PhpClassMethodNode)
		if (!phpMethodNodes) return null
		for (const phpMethodNode of phpMethodNodes) {
			const node = phpMethodNode.getNode()
			const eelHelper = workspace.neosWorkspace.getEelHelperTokensByName(node.eelHelper.identifier)
			if (!eelHelper) continue

			const method = eelHelper.methods.find(method => method.valid(node.identifier))
			if (!method) continue
			if (!(node.pathNode instanceof ObjectFunctionPathNode)) continue

			for (const index in node.pathNode.args) {
				const arg = node.pathNode.args[index]
				if (!this.canShowInlayHintForArgumentNode(workspace, arg)) continue

				const parameter = method.parameters[index]
				if (!parameter) continue

				const linePositionedArg = LinePositionedNode.Get(<any>arg)

				const hint: InlayHint = {
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
				}

				inlayHints.push(hint)
			}
		}

		return inlayHints
	}

	protected canShowInlayHintForArgumentNode(workspace: FusionWorkspace, argumentNode: AbstractNode) {
		if (workspace.getConfiguration().inlayHint.depth === InlayHintDepth.Always) return true
		return argumentNode instanceof AbstractLiteralNode || argumentNode instanceof LiteralObjectNode || argumentNode instanceof LiteralArrayNode
	}
}