import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { DslExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/DslExpressionValue'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/nodes/MetaPathSegment'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import { LegacyNodeService } from '../common/LegacyNodeService'
import { abstractNodeToString, findParent } from '../common/util'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'
import { NodeService } from '../common/NodeService'

function hasObjectNodeApplicableObjectStatement(node: ObjectNode) {
	const objectStatement = findParent(node, ObjectStatement)
	if (objectStatement === undefined) return false
	if (objectStatement.path.segments[0] instanceof MetaPathSegment) return false

	return true
}

function hasObjectNodeApplicablePath(node: ObjectNode) {
	// TODO: allow more diagnostics 
	const pathBegin = node.path[0].value
	if (pathBegin !== "props" && pathBegin !== "private") return false
	if (node.path.length === 1) return false
	if (node.path[1].value === "content") return false

	return true
}

export function diagnoseFusionProperties(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const debug = false

	const positionedObjectNodes = parsedFusionFile.getNodesByType(ObjectNode)
	if (positionedObjectNodes === undefined) return diagnostics

	for (const positionedObjectNode of positionedObjectNodes) {
		const node = positionedObjectNode.getNode()

		if (!hasObjectNodeApplicableObjectStatement(node)) continue
		if (!hasObjectNodeApplicablePath(node)) continue
		if (LegacyNodeService.isNodeAffectedByIgnoreComment(node, parsedFusionFile)) continue

		// FIXME: `@context.test = ${this.test}` resolves as correct even if `this.test` is not defined
		let fusionContext = NodeService.getFusionContextUntilNode(node, parsedFusionFile.workspace)
		const objectPathParts = node.path.map(segment => segment["value"])

		if (debug) console.log("objectPathParts", objectPathParts.join("."))
		if (debug) console.log("fusionContext", fusionContext)

		let found = false

		// TODO: if nothing is found, check if @propTypes exist
		for (const objectPathPart of objectPathParts) {
			if (!(objectPathPart in fusionContext)) {
				// TODO: check if there is a better way. Currently not found stuff is ignored: `prop.thing.notFound`
				found = objectPathParts.indexOf(objectPathPart) > 1
				break
			}
			found = true
			fusionContext = fusionContext[objectPathPart]
			if (fusionContext === null) break
			if (typeof fusionContext["__eelExpression"] === "string") break
		}

		// if (debug) console.log("found", found)
		if (found) continue

		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: positionedObjectNode.getPositionAsRange(),
			message: `Could not resolve "${abstractNodeToString(node)}"`,
			source: CommonDiagnosticHelper.Source,
			data: {
				quickAction: 'ignorable',
				commentType: findParent(node, DslExpressionValue) ? 'afx' : 'fusion',
				affectedNodeRange: LegacyNodeService.getAffectedNodeBySemanticComment(node)!.linePositionedNode.getPositionAsRange()
			}
		}

		diagnostics.push(diagnostic)
	}

	return diagnostics
}