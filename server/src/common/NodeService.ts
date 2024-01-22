import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { DslExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/DslExpressionValue'
import { EelExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/EelExpressionValue'
import { FusionFile } from 'ts-fusion-parser/out/fusion/nodes/FusionFile'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/nodes/MetaPathSegment'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { StatementList } from 'ts-fusion-parser/out/fusion/nodes/StatementList'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { ValueCopy } from 'ts-fusion-parser/out/fusion/nodes/ValueCopy'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { abstractNodeToString, checkSemanticCommentIgnoreArguments, findParent, findUntil, getObjectIdentifier } from './util'
import { AbstractPathValue } from 'ts-fusion-parser/out/fusion/nodes/AbstractPathValue'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { Comment } from 'ts-fusion-parser/out/common/Comment'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { LinePositionedNode } from './LinePositionedNode'
import { SemanticCommentService, SemanticCommentType } from './SemanticCommentService'

export class ExternalObjectStatement {
	constructor(
		public statement: ObjectStatement,
		public uri?: string
	) { }
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

		if (foundParentOperationPrototype instanceof ObjectStatement) {
			const operation = <ValueAssignment>foundParentOperationPrototype.operation
			return (<FusionObjectValue>operation.pathValue).value
		}
		return ""
	}

	public findPrototypeName(node: AbstractNode) {
		const objectStatement = findParent(node, ObjectStatement)
		if (!objectStatement) return undefined
		if (!(objectStatement.path.segments[0] instanceof PrototypePathSegment)) return undefined
		return objectStatement.path.segments[0].identifier
	}

	public getPrototypeNameFromObjectStatement(objectStatement: ObjectStatement) {
		const parentOperation = objectStatement.operation
		if (parentOperation instanceof ValueAssignment) {
			if (parentOperation.pathValue instanceof FusionObjectValue) {
				return parentOperation.pathValue.value
			}
		}

		if (objectStatement.path.segments[0] instanceof PrototypePathSegment) {
			return objectStatement.path.segments[0].identifier
		}

		return undefined
	}

	public isPrototypeOneOf(prototypeName: string, oneOf: string, workspace: FusionWorkspace) {
		if (prototypeName === oneOf) return true

		for (const parsedFile of workspace.parsedFiles) {
			for (const prototypeCreation of [...parsedFile.prototypeCreations, ...parsedFile.prototypeOverwrites]) {
				const objectStatement = findParent(prototypeCreation.getNode(), ObjectStatement)
				if (!objectStatement) continue

				const prototype = objectStatement.path.segments[0]
				if (!(prototype instanceof PrototypePathSegment)) continue
				if (prototype.identifier !== prototypeName) continue

				if (!(objectStatement.operation instanceof ValueCopy)) continue
				const copiedPrototype = objectStatement.operation.assignedObjectPath.objectPath.segments[0]
				if (!(copiedPrototype instanceof PrototypePathSegment)) continue
				if (copiedPrototype.identifier === oneOf) return true
				if (this.isPrototypeOneOf(copiedPrototype.identifier, oneOf, workspace)) return true
			}
		}

		return false
	}

	public * findPropertyDefinitionSegments(objectNode: ObjectNode | ObjectStatement, workspace?: FusionWorkspace, includeOverwrites = false) {
		const objectStatement = objectNode instanceof ObjectStatement ? objectNode : findParent(objectNode, ObjectStatement) // [props.foo]
		if (!objectStatement) return

		let statementList = findParent(objectNode, StatementList)
		if (!statementList) return

		// TODO: get object identifier and match it runtime-like against the property definition to check if it resolves 
		const isObjectStatementRenderer = (
			getObjectIdentifier(objectStatement).startsWith("renderer.")
			&& !getObjectIdentifier(objectStatement).startsWith("renderer.@process")
		) || (
				getObjectIdentifier(objectStatement).startsWith("@private.")
				&& !getObjectIdentifier(objectStatement).startsWith("@private.@process")
			)

		if (isObjectStatementRenderer) {
			const parentObjectStatement = findParent(statementList, ObjectStatement)

			if (parentObjectStatement) {
				const prototypeName = this.getPrototypeNameFromObjectStatement(objectStatement)
				if (prototypeName) {
					yield* this.getInheritedPropertiesByPrototypeName(prototypeName, workspace!, includeOverwrites)
				}
			}
		}

		const parentPrototypeName = this.findPrototypeName(objectStatement)
		if (parentPrototypeName) {
			const potentialSurroundingPrototypeName = this.findPrototypeName(findParent(objectStatement, ObjectStatement)!)
			if (potentialSurroundingPrototypeName) {
				yield* this.getInheritedPropertiesByPrototypeName(parentPrototypeName, workspace!, includeOverwrites)
			}
		}


		let wasComingFromRenderer = false
		const dsl = findParent(objectNode, DslExpressionValue)
		if (dsl !== undefined) {
			const parentPrototypeName = this.findParentPrototypeName(statementList)
			wasComingFromRenderer = getObjectIdentifier(findParent(dsl, ObjectStatement)!) === "renderer" && this.doesPrototypeOverrideProps(parentPrototypeName)
		}

		let traverseUpwards = true
		let skipNextStatements = false
		let onlyWhenFoundApplyProps = false

		do {
			if (!onlyWhenFoundApplyProps && wasComingFromRenderer) onlyWhenFoundApplyProps = true

			const parentObjectNode = findParent(statementList, ObjectStatement)
			const parentObjectIdentifier = parentObjectNode ? parentObjectNode.path.segments[0].identifier : ""
			const isParentObjectMeta = parentObjectNode ? parentObjectNode.path.segments[0] instanceof MetaPathSegment : false
			let foundApplyProps = false

			const statements: Array<ObjectStatement | ExternalObjectStatement> = [...<ObjectStatement[]>statementList.statements]
			if (workspace !== undefined) {
				const parentStatementList = findParent(statementList, StatementList)
				if (parentStatementList) {
					const willBeInPrototypeSegmentList = parentStatementList.parent instanceof FusionFile
					if (willBeInPrototypeSegmentList) {
						const prototypeObjectStatement = findParent(statementList, ObjectStatement)
						if (prototypeObjectStatement) {
							const operation = prototypeObjectStatement.operation

							const prototypeSegment = operation instanceof ValueCopy ? operation.assignedObjectPath.objectPath.segments[0] : prototypeObjectStatement.path.segments[0]
							if (prototypeSegment instanceof PrototypePathSegment) {
								statements.push(...this.getInheritedPropertiesByPrototypeName(prototypeSegment.identifier, workspace, includeOverwrites))
							}
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
				for (const propType of foundPropTypes.block!.statementList.statements) {
					if (!(propType instanceof ObjectStatement)) continue
					yield propType.path.segments[0]
				}
			}

			let parentIdentifiersRenderer = false
			if (parentObjectIdentifier === "renderer" || (parentObjectIdentifier === "private" && isParentObjectMeta)) {
				const rendererPrototype = findUntil<ObjectStatement>(parentObjectNode, (node) => {
					if (!(node instanceof ObjectStatement)) return false
					if (!(node.operation instanceof ValueAssignment)) return false
					if (!(node.operation.pathValue instanceof FusionObjectValue)) return false
					return true
				})
				parentIdentifiersRenderer = true
				if (rendererPrototype instanceof ObjectStatement && rendererPrototype.operation instanceof ValueAssignment && "value" in rendererPrototype.operation.pathValue) {
					parentIdentifiersRenderer = this.doesPrototypeOverrideProps(rendererPrototype.operation.pathValue.value as string)
				}
			}

			skipNextStatements = !parentIdentifiersRenderer
			if (!wasComingFromRenderer) wasComingFromRenderer = parentIdentifiersRenderer

			traverseUpwards = !onlyWhenFoundApplyProps || foundApplyProps
			statementList = findParent(statementList, StatementList)
		} while (traverseUpwards && statementList && !(statementList.parent instanceof FusionFile))
	}

	public findPropertyDefinitionSegment(objectNode: ObjectNode, workspace?: FusionWorkspace, includeOverwrites = false) {
		for (const segmentOrExternalStatement of this.findPropertyDefinitionSegments(objectNode, workspace, includeOverwrites)) {
			if (segmentOrExternalStatement instanceof ExternalObjectStatement) {
				if (segmentOrExternalStatement.statement.path.segments[0].identifier === objectNode.path[1].value) return segmentOrExternalStatement
			}
			if (!(segmentOrExternalStatement instanceof PathSegment)) continue
			if (segmentOrExternalStatement.identifier === "renderer") continue

			if (objectNode.path.length > 1 && segmentOrExternalStatement.identifier === objectNode.path[1].value) {
				return segmentOrExternalStatement
			}
		}

		return undefined
	}

	protected getAppliedPropsFromPathValue(pathValue: AbstractPathValue): boolean | ObjectStatement[] {
		if (pathValue instanceof EelExpressionValue) {
			const appliedObjectNode = Array.isArray(pathValue.nodes) ? pathValue.nodes[0] : pathValue.nodes
			if (!(appliedObjectNode instanceof ObjectNode)) return false
			if (appliedObjectNode.path[0].value === "props") return true

			return false
		}
		if (pathValue instanceof FusionObjectValue) {
			// TODO: Allow more than just `Neos.Fusion:DataStructure` as @apply value
			if (pathValue.value !== "Neos.Fusion:DataStructure") return false
			const objectStatement = findParent(pathValue, ObjectStatement)
			if (!objectStatement?.block) return false
			const applyStatements: ObjectStatement[] = []
			applyStatements.push(...objectStatement.block.statementList.statements as ObjectStatement[])
			return applyStatements.length === 0 ? false : applyStatements
		}

		return false
	}

	public foundApplyProps(statement: ObjectStatement): FoundApplyPropsResult | false {
		const segment = statement.path.segments[0]
		if (!(segment instanceof MetaPathSegment && segment.identifier === "apply")) return false


		const result: FoundApplyPropsResult = {
			appliedProps: false
		}

		const applyStatements = statement.operation instanceof ValueAssignment ? [statement] : statement.block?.statementList.statements
		if (!applyStatements) return false
		const foundStatements: any[] = []
		for (const applyStatement of applyStatements) {
			if (!(applyStatement instanceof ObjectStatement)) continue
			if (!(applyStatement.operation instanceof ValueAssignment)) continue

			const res = this.getAppliedPropsFromPathValue(applyStatement.operation.pathValue)
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

	public * getInheritedPropertiesByPrototypeName(name: string, workspace: FusionWorkspace, includeOverwrites = false, debug = false): Generator<ExternalObjectStatement, void, unknown> {
		for (const otherParsedFile of workspace.parsedFiles) {
			yield* this.getInheritedPropertiesByPrototypeNameFromParsedFile(name, otherParsedFile, workspace, includeOverwrites, debug)
		}
	}

	public * getInheritedPropertiesByPrototypeNameFromParsedFile(name: string, parsedFile: ParsedFusionFile, workspace: FusionWorkspace, includeOverwrites = false, debug = false) {
		const prototypeNodes = [...parsedFile.prototypeCreations]
		if (includeOverwrites) prototypeNodes.push(...parsedFile.prototypeOverwrites)
		for (const positionedNode of prototypeNodes) {
			yield* this.getInheritedPropertiesByPrototypeNameFromPrototypePathSegments(name, workspace, parsedFile, positionedNode, includeOverwrites, debug)
		}
	}

	public * getInheritedPropertiesByPrototypeNameFromPrototypePathSegments(name: string, workspace: FusionWorkspace, parsedFile: ParsedFusionFile, positionedNode: LinePositionedNode<PrototypePathSegment>, includeOverwrites = false, debug = false) {
		if (positionedNode.getNode().identifier !== name) return
		const objectStatement = findParent(positionedNode.getNode(), ObjectStatement)
		if (!objectStatement) return

		const operation = objectStatement.operation
		if (operation instanceof ValueCopy) {
			const prototypeSegment = operation.assignedObjectPath.objectPath.segments[0]
			if (!(prototypeSegment instanceof PrototypePathSegment)) return
			yield* this.getInheritedPropertiesByPrototypeName(prototypeSegment.identifier, workspace, includeOverwrites)
		}

		if (!objectStatement.block) return

		yield* this.getMetaPropTypesAsExternalObjectStatements(objectStatement, parsedFile)
	}

	public * getMetaPropTypesAsExternalObjectStatements(objectStatement: ObjectStatement, parsedFile: ParsedFusionFile) {
		let foundPropTypes: ObjectStatement | undefined = undefined
		for (const statement of objectStatement.block!.statementList.statements) {
			if (!(statement instanceof ObjectStatement)) continue

			const firstPathSegment = statement.path.segments[0]
			if (firstPathSegment instanceof MetaPathSegment && firstPathSegment.identifier.toLowerCase() === "proptypes") {
				foundPropTypes = statement
				continue
			}

			yield new ExternalObjectStatement(statement, parsedFile.uri)
		}

		if (!foundPropTypes?.block) return
		for (const propType of foundPropTypes.block.statementList.statements) {
			if (!(propType instanceof ObjectStatement)) continue
			yield new ExternalObjectStatement(propType, parsedFile.uri)
		}
	}

	public affectsCommentTheProperty(propertyName: string, commentNode: Comment, type: SemanticCommentType) {
		const parsedSemanticComment = SemanticCommentService.parseSemanticComment(commentNode.value.trim())
		if (!parsedSemanticComment) return false
		if (parsedSemanticComment.type !== type) return false

		return checkSemanticCommentIgnoreArguments(propertyName, parsedSemanticComment.arguments)
	}

	public isNodeAffectedByIgnoreComment(node: AbstractNode, parsedFusionFile: ParsedFusionFile) {
		const { foundIgnoreComment, foundIgnoreBlockComment } = this.getSemanticCommentsNodeIsAffectedBy(node, parsedFusionFile)
		return foundIgnoreComment || foundIgnoreBlockComment
	}

	public getSemanticCommentsNodeIsAffectedBy(node: AbstractNode, parsedFusionFile: ParsedFusionFile) {
		const objectStatementText = abstractNodeToString(node)
		if (!objectStatementText) {
			return {
				foundIgnoreComment: undefined,
				foundIgnoreBlockComment: undefined
			}
		}
		const affectedNodeBySemanticComment = this.getAffectedNodeBySemanticComment(node)
		if (!affectedNodeBySemanticComment) {
			return {
				foundIgnoreComment: undefined,
				foundIgnoreBlockComment: undefined
			}
		}
		const affectedLine = affectedNodeBySemanticComment.linePositionedNode.getBegin().line - 1

		if (!parsedFusionFile.nodesByLine) {
			return {
				foundIgnoreComment: undefined,
				foundIgnoreBlockComment: undefined
			}
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

	public getAffectedNodeBySemanticComment(node: AbstractNode) {
		return node.parent instanceof TagAttributeNode ? findParent(node, TagNode) : node
	}
}

const nodeService = new NodeService
export { NodeService as NodeServiceClass, nodeService as NodeService }