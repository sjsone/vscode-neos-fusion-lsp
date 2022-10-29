import { ObjectNode } from 'ts-fusion-parser/out/eel/nodes/ObjectNode'
import { DslExpressionValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/DslExpressionValue'
import { EelExpressionValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/EelExpressionValue'
import { FusionFile } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionFile'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/MetaPathSegment'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment'
import { StatementList } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/StatementList'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueAssignment'
import { ValueCopy } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueCopy'
import { FusionWorkspace } from './fusion/FusionWorkspace'
import { findParent } from './util'

export class ExternalObjectStatement {
	statement: ObjectStatement
	uri?: string

	constructor(statement: ObjectStatement, uri: string) {
		this.statement = statement
		this.uri = uri
	}
}

class NodeService {


	public * findPropertyDefinitionSegments(objectNode: ObjectNode, workspace?: FusionWorkspace) {
		const objectStatement = findParent(objectNode, ObjectStatement) // [props.foo]

		let wasComingFromRenderer = false
		const dsl = findParent(objectNode, DslExpressionValue)
		if (dsl !== undefined) {
			wasComingFromRenderer = findParent(dsl, ObjectStatement).path.segments[0]["identifier"] === "renderer"
		}

		let statementList = findParent(objectNode, StatementList)

		let traverseUpwards = true
		let skipNextStatements = false
		let onlyWhenFoundApplyProps = false

		do {
			if (!onlyWhenFoundApplyProps && wasComingFromRenderer) onlyWhenFoundApplyProps = true

			const parentObjectNode = findParent(statementList, ObjectStatement)
			const parentObjectIdentifier = parentObjectNode ? parentObjectNode.path.segments[0]["identifier"] : ""
			let foundApplyProps = false

			const statements: Array<ObjectStatement | ExternalObjectStatement> = [...<ObjectStatement[]>statementList.statements]
			if (workspace !== undefined) {
				const parentStatementList = findParent(statementList, StatementList)
				if (parentStatementList) {
					const willBeInPrototypeSegmentList = parentStatementList["parent"] instanceof FusionFile
					if (willBeInPrototypeSegmentList) {
						const operation = findParent(statementList, ObjectStatement).operation
						if (operation instanceof ValueCopy) {
							const prototypeSegment = operation.assignedObjectPath.objectPath.segments[0]
							if (prototypeSegment instanceof PrototypePathSegment) {
								statements.push(...this.getInheritedPropertiesByPrototypeName(prototypeSegment.identifier, workspace))
							}
						}
					}
				}
			}

			for (const statement of statements) {
				if (statement instanceof ExternalObjectStatement) {
					yield statement
				}
				if (!(statement instanceof ObjectStatement)) continue
				if (statement === objectStatement) continue // Let it not find itself

				if (!foundApplyProps) foundApplyProps = this.foundApplyProps(statement)
				if (!skipNextStatements) yield statement.path.segments[0]
			}

			skipNextStatements = parentObjectIdentifier !== "renderer"
			if (!wasComingFromRenderer) wasComingFromRenderer = parentObjectIdentifier === "renderer"

			traverseUpwards = !onlyWhenFoundApplyProps || foundApplyProps
			statementList = findParent(statementList, StatementList)
		} while (traverseUpwards && statementList && !(statementList["parent"] instanceof FusionFile))
	}

	public findPropertyDefinitionSegment(objectNode: ObjectNode, workspace?: FusionWorkspace) {
		for (const segmentOrExternalStatement of this.findPropertyDefinitionSegments(objectNode, workspace)) {
			if (segmentOrExternalStatement instanceof ExternalObjectStatement) {
				if (segmentOrExternalStatement.statement.path.segments[0]["identifier"] === objectNode.path[1]["value"]) return segmentOrExternalStatement
			}
			if (!(segmentOrExternalStatement instanceof PathSegment)) continue
			// TODO: Decide what to do with "renderer"
			if (segmentOrExternalStatement.identifier === "renderer") continue

			if (objectNode.path.length > 1 && segmentOrExternalStatement.identifier === objectNode.path[1]["value"]) {
				return segmentOrExternalStatement
			}
		}

		return undefined
	}

	public foundApplyProps(statement: ObjectStatement): boolean {
		const segment = statement.path.segments[0]

		if (!(segment instanceof MetaPathSegment && segment.identifier === "apply")) return false
		if (!(statement.operation instanceof ValueAssignment)) return false
		if (!(statement.operation.pathValue instanceof EelExpressionValue)) return false

		const pathValueNodes = statement.operation.pathValue.nodes
		const appliedObjectNode = Array.isArray(pathValueNodes) ? pathValueNodes[0] : pathValueNodes
		if (!(appliedObjectNode instanceof ObjectNode)) return false

		return appliedObjectNode.path[0]["value"] === "props"
	}

	public getInheritedPropertiesByPrototypeName(name: string, workspace: FusionWorkspace) {
		const statements: Array<ExternalObjectStatement> = []
		for (const otherParsedFile of workspace.parsedFiles) {
			for (const positionedNode of [...otherParsedFile.prototypeCreations]) {
				if (positionedNode.getNode()["identifier"] !== name) continue
				const node = positionedNode.getNode()
				const objectStatement = findParent(node, ObjectStatement)
				const operation = objectStatement.operation
				if (operation instanceof ValueCopy) {
					const prototypeSegment = operation.assignedObjectPath.objectPath.segments[0]
					if (prototypeSegment instanceof PrototypePathSegment) {
						statements.push(...this.getInheritedPropertiesByPrototypeName(prototypeSegment.identifier, workspace))
					}
				}

				for (const statement of objectStatement.block.statementList.statements) {
					if (!(statement instanceof ObjectStatement)) continue
					statements.push(new ExternalObjectStatement(statement, otherParsedFile.uri))
				}
			}
		}

		return statements
	}
}

const nodeService = new NodeService
export { NodeService as NodeServiceClass, nodeService as NodeService }