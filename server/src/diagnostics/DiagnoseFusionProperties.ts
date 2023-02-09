import { Comment } from 'ts-fusion-parser/out/common/Comment'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { DslExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/DslExpressionValue'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/nodes/MetaPathSegment'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import { DefinitionCapability } from '../capabilities/DefinitionCapability'
import { findParent, parseSemanticComment, SemanticCommentType, checkSemanticCommentIgnoreArguments, findUntil } from '../common/util'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'

export function diagnoseFusionProperties(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const positionedObjectNodes = parsedFusionFile.getNodesByType(ObjectNode)
	if (positionedObjectNodes === undefined) return diagnostics

	// TODO: Put logic of DefinitionCapability in a Provider/Service instead of using a Capability 
	const definitionCapability = new DefinitionCapability(parsedFusionFile.workspace.languageServer)

	for (const positionedObjectNode of positionedObjectNodes) {
		const node = positionedObjectNode.getNode()

		const objectStatement = findParent(node, ObjectStatement)
		if (objectStatement === undefined) continue
		if (objectStatement.path.segments[0] instanceof MetaPathSegment) continue

		const pathBegin = node.path[0]["value"]
		if (pathBegin !== "props") continue
		if (node.path.length === 1) continue
		if (node.path[1]["value"] === "content") continue

		const definition = definitionCapability.getPropertyDefinitions(this, parsedFusionFile.workspace, node.path[0].linePositionedNode)
		if (definition) continue

		const objectStatementText = node.path.map(e => e["value"]).join(".")

		const affectedNodeBySemanticComment = node["parent"] instanceof TagAttributeNode ? findParent(node, TagNode) : node
		const nodesByLine = parsedFusionFile.nodesByLine[affectedNodeBySemanticComment.linePositionedNode.getBegin().line - 1] ?? []

		const foundIgnoreComment = nodesByLine.find(nodeByLine => {
			const commentNode = nodeByLine.getNode()
			if (!(commentNode instanceof Comment)) return false

			const parsedSemanticComment = parseSemanticComment(commentNode.value.trim())
			if (!parsedSemanticComment) return false
			if (parsedSemanticComment.type !== SemanticCommentType.Ignore) return false

			return checkSemanticCommentIgnoreArguments(objectStatementText, parsedSemanticComment.arguments)
		})
		if (foundIgnoreComment) continue

		const fileComments = parsedFusionFile.getNodesByType(Comment) ?? []
		const foundIgnoreBlockComment = (fileComments ? fileComments : []).find(positionedComment => {
			const commentNode = positionedComment.getNode()

			const parsedSemanticComment = parseSemanticComment(commentNode.value.trim())
			if (!parsedSemanticComment) return false
			if (parsedSemanticComment.type !== SemanticCommentType.IgnoreBlock) return false

			if (!checkSemanticCommentIgnoreArguments(objectStatementText, parsedSemanticComment.arguments)) return false

			const commentParent = commentNode["parent"]
			return !!findUntil(node, parentNode => parentNode === commentParent)
		})
		if (foundIgnoreBlockComment) continue

		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: positionedObjectNode.getPositionAsRange(),
			message: `Could not resolve "${objectStatementText}"`,
			source: CommonDiagnosticHelper.Source,
			data: {
				quickAction: 'ignorable',
				commentType: findParent(node, DslExpressionValue) ? 'afx' : 'fusion',
				affectedNodeRange: affectedNodeBySemanticComment.linePositionedNode.getPositionAsRange()
			}
		}

		diagnostics.push(diagnostic)
	}

	return diagnostics
}