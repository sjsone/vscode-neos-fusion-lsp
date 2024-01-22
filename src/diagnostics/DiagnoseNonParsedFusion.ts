import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'

export function diagnoseNonParsedFusion(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const tagNodes = parsedFusionFile.getNodesByType(TagNode)
	if (!tagNodes) return diagnostics

	for (const tagNode of tagNodes) {
		const tagNodeName = tagNode.getNode().name.toLowerCase()
		if (tagNodeName !== "script") continue

		diagnostics.push({
			range: tagNode.getPositionAsRange(),
			severity: DiagnosticSeverity.Hint,
			source: CommonDiagnosticHelper.Source,
			message: `Fusion Support does not work in "<${tagNodeName}>" tags`
		})
	}

	return diagnostics
}