import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import { ActionUriActionNode } from '../fusion/node/ActionUriActionNode'
import { ActionUriControllerNode } from '../fusion/node/ActionUriControllerNode'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'

export function diagnoseActionUri(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const severity = DiagnosticSeverity.Warning

	const actionUriActionNodes = parsedFusionFile.getNodesByType(ActionUriActionNode) ?? []
	for (const actionUriActionNode of actionUriActionNodes) {
		const actionNameNode = actionUriActionNode.getNode().name
		const actionName = actionNameNode.value

		if (actionName.endsWith("Action")) diagnostics.push({
			severity,
			range: actionNameNode.linePositionedNode.getPositionAsRange(),
			message: `Neos would interpret this as "${actionName}Action". Remove "Action" from the name.`,
			source: CommonDiagnosticHelper.Source
		})
	}

	const actionUriControllerNodes = parsedFusionFile.getNodesByType(ActionUriControllerNode) ?? []
	for (const actionUriControllerNode of actionUriControllerNodes) {
		const actionNameNode = actionUriControllerNode.getNode().name
		const actionName = actionNameNode.value

		if (actionName.endsWith("Controller")) diagnostics.push({
			severity,
			range: actionNameNode.linePositionedNode.getPositionAsRange(),
			message: `Neos would interpret this as "${actionName}Controller". Remove "Controller" from the name.`,
			source: CommonDiagnosticHelper.Source
		})
	}

	return diagnostics
}