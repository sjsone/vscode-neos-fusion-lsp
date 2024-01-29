import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { DslExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/DslExpressionValue'
import { findParent } from '../common/util'
import { InlineEelNode } from 'ts-fusion-parser/out/dsl/afx/nodes/InlineEelNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { TextNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TextNode'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'

export function diagnoseAfxWithDollarEel(parsedFusionFile: ParsedFusionFile): Diagnostic[] {
	const diagnostics: Diagnostic[] = []

	const inlineEelNodes = parsedFusionFile.getNodesByType(InlineEelNode)
	if (!inlineEelNodes) return diagnostics

	for (const inlineEelNode of inlineEelNodes) {
		const node = inlineEelNode.getNode()

		const parentDslExpression = findParent(node, DslExpressionValue)
		if (!parentDslExpression) continue

		for (const content of getSiblings(node)) {
			if (!(content instanceof TextNode)) continue
			if (!content.text.endsWith("$")) continue
			if (content.position.end !== node.position.begin) continue

			const range = inlineEelNode.getPositionAsRange()
			range.start.character -= 1

			diagnostics.push({
				severity: DiagnosticSeverity.Warning,
				range,
				message: `\`$\` before an EEL-Expression is not needed inside AFX`,
				source: CommonDiagnosticHelper.Source,
			})
		}

	}

	return diagnostics
}

const getSiblings = (node: InlineEelNode) => {
	if (node.parent instanceof TagNode) return node.parent.content!
	if (node.parent instanceof DslExpressionValue) return node.parent.htmlNodes
	return []
}