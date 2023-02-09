import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { PhpClassMethodNode } from '../fusion/PhpClassMethodNode'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'

export function diagnoseEelHelperArguments(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []
	const positionedNodes = parsedFusionFile.getNodesByType(PhpClassMethodNode)
	if (!positionedNodes) return diagnostics
	for (const positionedNode of positionedNodes) {
		const node = positionedNode.getNode()
		const pathNode = node.pathNode
		if (!(pathNode instanceof ObjectFunctionPathNode)) continue

		for (const eelHelper of parsedFusionFile.workspace.neosWorkspace.getEelHelperTokens()) {
			if (eelHelper.name !== node.eelHelper.identifier) continue
			const method = eelHelper.methods.find(method => method.valid(node.identifier))
			if (!method) continue

			for (const parameterIndex in method.parameters) {
				const parameter = method.parameters[parameterIndex]
				if (parameter.defaultValue !== undefined) break
				if (pathNode.args[parameterIndex] === undefined) {
					const diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Error,
						range: positionedNode.getPositionAsRange(),
						message: `Missing argument`,
						source: CommonDiagnosticHelper.Source
					}
					diagnostics.push(diagnostic)
				}
			}

			if (pathNode.args.length > method.parameters.length) {
				for (const exceedingArgument of pathNode.args.slice(method.parameters.length)) {
					const diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Warning,
						range: exceedingArgument.linePositionedNode.getPositionAsRange(),
						message: `Too many arguments provided`,
						source: CommonDiagnosticHelper.Source
					}
					diagnostics.push(diagnostic)
				}
			}
		}
	}

	return diagnostics
}