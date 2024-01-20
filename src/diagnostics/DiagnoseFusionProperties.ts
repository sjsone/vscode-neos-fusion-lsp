import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { DslExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/DslExpressionValue'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/nodes/MetaPathSegment'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import { DefinitionCapability } from '../capabilities/DefinitionCapability'
import { NodeService } from '../common/NodeService'
import { abstractNodeToString, findParent } from '../common/util'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'

function hasObjectNodeApplicableObjectStatement(node: ObjectNode) {
	const objectStatement = findParent(node, ObjectStatement)
	if (objectStatement === undefined) return false
	if (objectStatement.path.segments[0] instanceof MetaPathSegment) return false

	return true
}

function hasObjectNodeApplicablePath(node: ObjectNode) {
	const pathBegin = node.path[0].value
	if (pathBegin !== "props") return false
	if (node.path.length === 1) return false
	if (node.path[1].value === "content") return false

	return true
}

export function diagnoseFusionProperties(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const positionedObjectNodes = parsedFusionFile.getNodesByType(ObjectNode)
	if (positionedObjectNodes === undefined) return diagnostics

	// TODO: Put logic of DefinitionCapability in a Provider/Service instead of using a Capability 
	const definitionCapability = new DefinitionCapability(parsedFusionFile.workspace.languageServer)

	for (const positionedObjectNode of positionedObjectNodes) {
		const node = positionedObjectNode.getNode()

		if (!hasObjectNodeApplicableObjectStatement(node)) continue
		if (!hasObjectNodeApplicablePath(node)) continue

		const definition = definitionCapability.getPropertyDefinitions(parsedFusionFile, parsedFusionFile.workspace, node.path[0].linePositionedNode)
		if (definition) continue

		if (NodeService.isNodeAffectedByIgnoreComment(node, parsedFusionFile)) continue

		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: positionedObjectNode.getPositionAsRange(),
			message: `Could not resolve "${abstractNodeToString(node)}"`,
			source: CommonDiagnosticHelper.Source,
			data: {
				quickAction: 'ignorable',
				commentType: findParent(node, DslExpressionValue) ? 'afx' : 'fusion',
				affectedNodeRange: NodeService.getAffectedNodeBySemanticComment(node)!.linePositionedNode.getPositionAsRange()
			}
		}

		diagnostics.push(diagnostic)
	}

	return diagnostics
}