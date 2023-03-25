import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'

export function diagnoseTagNames(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const positionedTagNodes = parsedFusionFile.getNodesByType(TagNode)
	if (positionedTagNodes === undefined) return diagnostics

	for (const positionedTagNode of positionedTagNodes) {
		const node = positionedTagNode.getNode()
		if (!node["selfClosing"]) continue
		if (node["end"]["name"] === "/>") continue
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: positionedTagNode.getPositionAsRange(),
			message: `Tags have to be closed`,
			source: CommonDiagnosticHelper.Source
		}
		diagnostics.push(diagnostic)
	}
	return diagnostics
}