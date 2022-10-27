import { ObjectNode } from 'ts-fusion-parser/out/eel/nodes/ObjectNode'
import { EelExpressionValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/EelExpressionValue'
import { FusionFile } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionFile'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/MetaPathSegment'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment'
import { StatementList } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/StatementList'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueAssignment'
import { findParent } from './util'

class NodeService {


	public * findPropertyDefinitionSegments(objectNode: ObjectNode) {
		const objectStatement = findParent(objectNode, ObjectStatement)
		// console.log("objectNode", objectNode)
		let statementList = findParent(objectNode, StatementList)
		let traverseUpwards = true
		let skipNextStatements = false
		let comingFromRenderer = false
		do {
			const parentObjectNode = findParent(statementList, ObjectStatement)
			const parentObjectIdentifier = parentObjectNode.path.segments[0]["identifier"]
			let foundApplyProps = false

			for (const statement of statementList.statements) {
				if (!(statement instanceof ObjectStatement)) continue
				if (statement === objectStatement) continue // Let it not find itself
				if (!foundApplyProps) foundApplyProps = this.shouldTraverseUpwardsTryingToFindPropertyDefinition(statement)
				if (!skipNextStatements) yield statement.path.segments[0]
			}

			skipNextStatements = parentObjectIdentifier !== "renderer"
			if (!comingFromRenderer) comingFromRenderer = parentObjectIdentifier === "renderer"

			statementList = findParent(statementList, StatementList)
			traverseUpwards = (!comingFromRenderer && skipNextStatements) || foundApplyProps
		} while (traverseUpwards && statementList && !(statementList["parent"] instanceof FusionFile))
	}

	public findPropertyDefinitionSegment(objectNode: ObjectNode) {
		for (const segment of this.findPropertyDefinitionSegments(objectNode)) {
			if (!(segment instanceof PathSegment)) continue
			// TODO: Decide what to do with "renderer"
			if (segment.identifier === "renderer") continue

			if (objectNode.path.length > 1 && segment.identifier === objectNode.path[1]["value"]) {
				return segment
			}
		}

		return undefined
	}

	public shouldTraverseUpwardsTryingToFindPropertyDefinition(statement: ObjectStatement): boolean {
		const segment = statement.path.segments[0]

		if (!(segment instanceof MetaPathSegment && segment.identifier === "apply")) return false
		if (!(statement.operation instanceof ValueAssignment)) return false
		if (!(statement.operation.pathValue instanceof EelExpressionValue)) return false

		const pathValueNodes = statement.operation.pathValue.nodes
		const appliedObjectNode = Array.isArray(pathValueNodes) ? pathValueNodes[0] : pathValueNodes
		if (!(appliedObjectNode instanceof ObjectNode)) return false

		return appliedObjectNode.path[0]["value"] === "props"
	}

}

const nodeService = new NodeService
export { NodeService as NodeServiceClass, nodeService as NodeService }