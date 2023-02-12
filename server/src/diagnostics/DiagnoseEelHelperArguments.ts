import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { PhpClassMethodNode } from '../fusion/PhpClassMethodNode'
import { EELHelperToken } from '../neos/NeosPackage'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'

function* getDiagnosticFromEelHelper(positionedNode: LinePositionedNode<PhpClassMethodNode>, pathNode: ObjectFunctionPathNode, eelHelper: EELHelperToken) {
	const node = positionedNode.getNode()
	if (eelHelper.name !== node.eelHelper.identifier) return
	const method = eelHelper.methods.find(method => method.valid(node.identifier))
	if (!method) return

	for (const parameterIndex in method.parameters) {
		const parameter = method.parameters[parameterIndex]
		if (parameter.defaultValue !== undefined) break
		if (pathNode.args[parameterIndex] === undefined) {
			yield {
				severity: DiagnosticSeverity.Error,
				range: positionedNode.getPositionAsRange(),
				message: `Missing argument`,
				source: CommonDiagnosticHelper.Source
			} as Diagnostic
		}
	}

	if (pathNode.args.length > method.parameters.length) {
		for (const exceedingArgument of pathNode.args.slice(method.parameters.length)) {
			yield {
				severity: DiagnosticSeverity.Warning,
				range: exceedingArgument.linePositionedNode.getPositionAsRange(),
				message: `Too many arguments provided`,
				source: CommonDiagnosticHelper.Source
			} as Diagnostic
		}
	}
}

export function diagnoseEelHelperArguments(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const positionedNodes = parsedFusionFile.getNodesByType(PhpClassMethodNode)
	if (!positionedNodes) return diagnostics
	for (const positionedNode of positionedNodes) {
		const node = positionedNode.getNode()
		const pathNode = node.pathNode
		if (!(pathNode instanceof ObjectFunctionPathNode)) continue

		// console.log(pathNode)

		for (const eelHelper of parsedFusionFile.workspace.neosWorkspace.getEelHelperTokens()) {
			for (const diagnostic of getDiagnosticFromEelHelper(positionedNode, pathNode, eelHelper)) {
				diagnostics.push(diagnostic)
			}
		}
	}

	return diagnostics
}