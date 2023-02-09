import { EmptyEelNode } from 'ts-fusion-parser/out/dsl/eel/nodes/EmptyEelNode'
import { EelExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/EelExpressionValue'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { Diagnostic, DiagnosticTag } from 'vscode-languageserver'
import { findParent } from '../common/util'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'

export function diagnoseEmptyEel(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const eelExpressions = parsedFusionFile.getNodesByType(EelExpressionValue)
	if (!eelExpressions) return diagnostics

	const severity = CommonDiagnosticHelper.getDeprecationsDiagnosticsLevel(parsedFusionFile)

	for (const eelExpression of eelExpressions) {
		const emptyEelNode = eelExpression.getNode().nodes
		if (!(emptyEelNode instanceof EmptyEelNode)) continue

		const valueAssignment = findParent(emptyEelNode, ValueAssignment)
		if (!valueAssignment) continue

		diagnostics.push({
			severity,
			range: valueAssignment.linePositionedNode.getPositionAsRange(),
			tags: [DiagnosticTag.Deprecated],
			message: `Use \`null\` instead of \`\${}\``,
			source: CommonDiagnosticHelper.Source,
			data: {
				deprecatedName: "${}",
				newName: " null"
			}
		})
	}

	return diagnostics
}
