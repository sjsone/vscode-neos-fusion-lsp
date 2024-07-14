import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { Comment } from 'ts-fusion-parser/out/common/Comment'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { abstractNodeToString, checkSemanticCommentIgnoreArguments, findParent, findUntil } from './util'
import { SemanticCommentService, SemanticCommentType } from './SemanticCommentService'

class LegacyNodeService {
	public isNodeAffectedByIgnoreComment(node: AbstractNode, parsedFusionFile: ParsedFusionFile) {
		const { foundIgnoreComment, foundIgnoreBlockComment } = this.getSemanticCommentsNodeIsAffectedBy(node, parsedFusionFile)
		return foundIgnoreComment || foundIgnoreBlockComment
	}

	public getAffectedNodeBySemanticComment(node: AbstractNode) {
		return node.parent instanceof TagAttributeNode ? findParent(node, TagNode) : node
	}

	protected affectsCommentTheProperty(propertyName: string, commentNode: Comment, type: SemanticCommentType) {
		const parsedSemanticComment = SemanticCommentService.parseSemanticComment(commentNode.value.trim())
		if (!parsedSemanticComment) return false
		if (parsedSemanticComment.type !== type) return false

		return checkSemanticCommentIgnoreArguments(propertyName, parsedSemanticComment.arguments)
	}

	protected getSemanticCommentsNodeIsAffectedBy(node: AbstractNode, parsedFusionFile: ParsedFusionFile) {
		const objectStatementText = abstractNodeToString(node)
		if (!objectStatementText) return {
			foundIgnoreComment: undefined,
			foundIgnoreBlockComment: undefined
		}

		const affectedNodeBySemanticComment = this.getAffectedNodeBySemanticComment(node)
		if (!affectedNodeBySemanticComment) return {
			foundIgnoreComment: undefined,
			foundIgnoreBlockComment: undefined
		}

		const affectedLine = affectedNodeBySemanticComment.linePositionedNode.getBegin().line - 1

		if (!parsedFusionFile.nodesByLine) return {
			foundIgnoreComment: undefined,
			foundIgnoreBlockComment: undefined
		}

		const nodesByLine = parsedFusionFile.nodesByLine[affectedLine] ?? []
		const foundIgnoreComment = nodesByLine.find(nodeByLine => {
			const commentNode = nodeByLine.getNode()
			if (!(commentNode instanceof Comment)) return false

			return this.affectsCommentTheProperty(objectStatementText, commentNode, SemanticCommentType.Ignore)
		})

		const fileComments = parsedFusionFile.getNodesByType(Comment) ?? []
		const foundIgnoreBlockComment = (fileComments ?? []).find(positionedComment => {
			const commentNode = positionedComment.getNode()
			if (!this.affectsCommentTheProperty(objectStatementText, commentNode, SemanticCommentType.IgnoreBlock)) return false

			const commentParent = commentNode.parent
			return !!findUntil(node, parentNode => parentNode === commentParent)
		})

		return {
			foundIgnoreComment,
			foundIgnoreBlockComment
		}
	}
}

const legacyNodeService = new LegacyNodeService
export { legacyNodeService as LegacyNodeService, LegacyNodeService as LegacyNodeServiceClass }
