import { ObjectNode } from 'ts-fusion-parser/out/eel/nodes/ObjectNode'
import { DslExpressionValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/DslExpressionValue'
import { EelExpressionValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/EelExpressionValue'
import { FusionFile } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionFile'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/MetaPathSegment'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment'
import { StatementList } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/StatementList'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueAssignment'
import { ValueCopy } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueCopy'
import { FusionWorkspace } from './fusion/FusionWorkspace'
import { findParent, findUntil, getObjectIdentifier } from './util'
import { AbstractPathValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/AbstractPathValue'
import { AbstractNode } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/AbstractNode'

export class ExternalObjectStatement {
	statement: ObjectStatement
	uri?: string

	constructor(statement: ObjectStatement, uri: string) {
		this.statement = statement
		this.uri = uri
	}
}

export interface FoundApplyPropsResult {
	appliedProps: boolean
	appliedStatements?: ObjectStatement[]
}

class NodeService {

	public doesPrototypeOverrideProps(name: string): boolean {
		return !["Neos.Fusion:Case", "Neos.Fusion:Loop", "Neos.Neos:ImageUri", "Neos.Neos:NodeUri"].includes(name)
	}

	public findParentPrototypeName(node: AbstractNode) {
		const foundParentOperationPrototype = findUntil(node, (possiblePrototype) => {
			if (!(possiblePrototype instanceof ObjectStatement)) return false
			if (!(possiblePrototype.operation instanceof ValueAssignment)) return false
			if (!(possiblePrototype.operation.pathValue instanceof FusionObjectValue)) return false
			return true
		})

		if (foundParentOperationPrototype) {
			return (<any>foundParentOperationPrototype).operation.pathValue.value
		}
		return ""
	}

	public findPrototypeName(node: AbstractNode) {
		const objectStatement = findParent(node, ObjectStatement)
		if (!objectStatement) return undefined
		if (!(objectStatement.path.segments[0] instanceof PrototypePathSegment)) return undefined
		return objectStatement.path.segments[0].identifier
	}

	public * findPropertyDefinitionSegments(objectNode: ObjectNode | ObjectStatement, workspace?: FusionWorkspace) {
		const objectStatement = objectNode instanceof ObjectStatement ? objectNode : findParent(objectNode, ObjectStatement) // [props.foo]

		let statementList = findParent(objectNode, StatementList)
		if (getObjectIdentifier(objectStatement).startsWith("renderer.")) {
			const parentObjectStatement = findParent(statementList, ObjectStatement)
			if (parentObjectStatement) {
				const parentOperation = parentObjectStatement.operation

				if (parentOperation instanceof ValueAssignment) {
					if (parentOperation.pathValue instanceof FusionObjectValue) {
						const statements = this.getInheritedPropertiesByPrototypeName(parentOperation.pathValue.value, workspace)
						for (const statement of statements) {
							if (statement instanceof ExternalObjectStatement) yield statement
							if (!(statement instanceof ObjectStatement)) continue
							yield statement.path.segments[0]
						}
						return
					}
				}
			}

			const parentPrototypeName = this.findPrototypeName(objectStatement)
			if (parentPrototypeName) {
				const potentialSurroundingPrototypeName = this.findPrototypeName(findParent(objectStatement, ObjectStatement))
				if (potentialSurroundingPrototypeName) {
					const statements = this.getInheritedPropertiesByPrototypeName(parentPrototypeName, workspace)

					for (const statement of statements) {
						if (statement instanceof ExternalObjectStatement) yield statement
						if (!(statement instanceof ObjectStatement)) continue
						yield statement.path.segments[0]
					}
					return
				}
			}
		}

		const parentPrototypeName = this.findParentPrototypeName(statementList)

		let wasComingFromRenderer = false
		const dsl = findParent(objectNode, DslExpressionValue)
		if (dsl !== undefined) {
			wasComingFromRenderer = getObjectIdentifier(findParent(dsl, ObjectStatement)) === "renderer" && this.doesPrototypeOverrideProps(parentPrototypeName)
		}

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
						const prototypeObjectStatement = findParent(statementList, ObjectStatement)
						const operation = prototypeObjectStatement.operation

						const prototypeSegment = operation instanceof ValueCopy ? operation.assignedObjectPath.objectPath.segments[0] : prototypeObjectStatement.path.segments[0]
						if (prototypeSegment instanceof PrototypePathSegment) {
							statements.push(...this.getInheritedPropertiesByPrototypeName(prototypeSegment.identifier, workspace))
						}
					}
				}
			}

			let foundPropTypes: ObjectStatement | undefined = undefined
			for (const statement of statements) {
				if (statement instanceof ExternalObjectStatement) yield statement
				if (!(statement instanceof ObjectStatement)) continue
				if (statement === objectStatement) continue // Let it not find itself

				// TODO: Reduce duplicated code from "findPropertyDefinitionSegments"
				const firstPathSegment = statement.path.segments[0]
				if (firstPathSegment instanceof MetaPathSegment && firstPathSegment.identifier.toLowerCase() === "proptypes") {
					foundPropTypes = statement
					continue
				}
				const applyProps = this.foundApplyProps(statement)
				if (applyProps !== false) {
					if (Array.isArray(applyProps.appliedStatements)) {
						for (const applyProp of applyProps.appliedStatements) yield applyProp.path.segments[0]
					}
					if (!foundApplyProps) foundApplyProps = applyProps.appliedProps !== false
				}

				if (!skipNextStatements) yield firstPathSegment
			}

			if (foundPropTypes !== undefined) {
				for (const propType of foundPropTypes.block.statementList.statements) {
					if (!(propType instanceof ObjectStatement)) continue
					yield propType.path.segments[0]
				}
			}

			let parentIdentifierisRenderer = false
			if (parentObjectIdentifier === "renderer") {
				const rendererPrototype = <ObjectStatement>findUntil(parentObjectNode, (node) => {
					if (!(node instanceof ObjectStatement)) return false
					if (!(node.operation instanceof ValueAssignment)) return false
					if (!(node.operation.pathValue instanceof FusionObjectValue)) return false
					return true
				})
				parentIdentifierisRenderer = true
				if (rendererPrototype instanceof ObjectStatement && rendererPrototype.operation instanceof ValueAssignment) {
					parentIdentifierisRenderer = this.doesPrototypeOverrideProps(rendererPrototype.operation.pathValue["value"])
				}
			}

			skipNextStatements = !parentIdentifierisRenderer
			if (!wasComingFromRenderer) wasComingFromRenderer = parentIdentifierisRenderer

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

	public foundApplyProps(statement: ObjectStatement): FoundApplyPropsResult | false {
		const segment = statement.path.segments[0]
		if (!(segment instanceof MetaPathSegment && segment.identifier === "apply")) return false

		const getApplies = (pathValue: AbstractPathValue): boolean | ObjectStatement[] => {
			if (pathValue instanceof EelExpressionValue) {
				const appliedObjectNode = Array.isArray(pathValue.nodes) ? pathValue.nodes[0] : pathValue.nodes
				if (!(appliedObjectNode instanceof ObjectNode)) return false
				if (appliedObjectNode.path[0]["value"] === "props") return true

				return false
			}
			if (pathValue instanceof FusionObjectValue) {
				if (pathValue.value !== "Neos.Fusion:DataStructure") return false
				const objectStatement = findParent(pathValue, ObjectStatement)
				if (!objectStatement.block) return false
				const applyStatements = []
				for (const statement of objectStatement.block.statementList.statements) {
					applyStatements.push(statement)
				}
				return applyStatements.length === 0 ? false : applyStatements
			}

			return false
		}

		const result: FoundApplyPropsResult = {
			appliedProps: false
		}

		const applyStatements = statement.operation instanceof ValueAssignment ? [statement] : statement.block.statementList.statements
		const foundStatements: any[] = []
		for (const applyStatement of applyStatements) {
			if (!(applyStatement instanceof ObjectStatement)) continue
			if (!(applyStatement.operation instanceof ValueAssignment)) continue

			const res = getApplies(applyStatement.operation.pathValue)
			if (res === true) result.appliedProps = true
			if (res !== false && Array.isArray(res)) {
				foundStatements.push(...res)
			}
		}
		if (foundStatements.length > 0) {
			result.appliedStatements = foundStatements
		}

		return result
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

				if (!objectStatement.block) continue

				let foundPropTypes: ObjectStatement | undefined = undefined
				for (const statement of objectStatement.block.statementList.statements) {
					if (!(statement instanceof ObjectStatement)) continue

					const firstPathSegment = statement.path.segments[0]
					if (firstPathSegment instanceof MetaPathSegment && firstPathSegment.identifier.toLowerCase() === "proptypes") {
						foundPropTypes = statement
						continue
					}

					statements.push(new ExternalObjectStatement(statement, otherParsedFile.uri))
				}

				if (foundPropTypes !== undefined) {
					for (const propType of foundPropTypes.block.statementList.statements) {
						if (!(propType instanceof ObjectStatement)) continue
						statements.push(new ExternalObjectStatement(propType, otherParsedFile.uri))
					}
				}
			}
		}

		return statements
	}
}

const nodeService = new NodeService
export { NodeService as NodeServiceClass, nodeService as NodeService }