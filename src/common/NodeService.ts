import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { RuntimeConfiguration } from 'ts-fusion-runtime'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { MergedArrayTreeService } from './MergedArrayTreeService'
import { findParent, pathToUri } from './util'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { AbstractPathSegment } from 'ts-fusion-parser/out/fusion/nodes/AbstractPathSegment'
import { IncompletePathSegment } from 'ts-fusion-parser/out/fusion/nodes/IncompletePathSegment'
import { EelExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/EelExpressionValue'
import { Logger } from './Logging'

export class ExternalObjectStatement {
	constructor(
		public statement: ObjectStatement,
		public uri?: string
	) { }
}

class NodeService extends Logger {
	public getFusionConfigurationListUntilNode(node: AbstractNode, workspace: FusionWorkspace, debug = false) {
		const baseNode = node instanceof PathSegment ? findParent(node, ObjectStatement)!.parent : node
		const pathForNode = MergedArrayTreeService.buildPathForNode(baseNode!)
		return pathForNode.map((pathPart, index) => {
			const path = pathForNode.slice(0, index + 1).join('/');
			const configuration = workspace.fusionRuntimeConfiguration.forPath(path)
			return {
				pathPart,
				configuration
			}
		})
	}

	public getFusionContextOfPrototype(prototypeName: string, workspace: FusionWorkspace) {
		return workspace.fusionRuntimeConfiguration.forPath(`/<${prototypeName}>`)
	}

	public getFusionContextUntilNode(node: AbstractNode, workspace: FusionWorkspace, debug = false) {
		const relevantTree = this.getFusionConfigurationListUntilNode(node, workspace, debug)

		// TODO: prefill fusion context with the correct values (from controller?, EEL-Helper?)
		const finalFusionContext = {} as { [key: string]: any }
		for (const relevantTreePart of relevantTree) {
			const relevantTreePartIndex = relevantTree.indexOf(relevantTreePart)
			const partConfiguration = relevantTreePart.configuration
			if ('__eelExpression' in partConfiguration && partConfiguration.__eelExpression !== null) continue

			const hasRenderer = partConfiguration.__objectType === 'Neos.Fusion:Component' || partConfiguration.__prototypeChain?.includes('Neos.Fusion:Component')
			const rendererNextInPath = relevantTree[relevantTreePartIndex + 1]?.pathPart === "renderer"
			const atPrivateNextInPath = relevantTree[relevantTreePartIndex + 1]?.pathPart === "__meta" && relevantTree[relevantTreePartIndex + 2]?.pathPart === "private"

			let thisFusionContext: { [key: string]: any } = {}
			const privateFusionContext: { [key: string]: any } = {}

			if (partConfiguration.__meta) {
				if (partConfiguration.__meta.context && typeof partConfiguration.__meta.context === "object") {
					// if (debug) console.log(`partConfiguration due to __meta.context::<${relevantTreePart.pathPart}>`, partConfiguration)
					for (const contextKey in partConfiguration.__meta.context) {
						finalFusionContext[contextKey] = partConfiguration.__meta.context[contextKey]
					}
				}

				// TODO: sort `__meta` before using it ("@position")
				if (partConfiguration.__meta.apply && typeof partConfiguration.__meta.apply === "object") {
					for (const valueToApply of this.getAppliedValues(partConfiguration.__meta.apply, finalFusionContext)) {
						thisFusionContext = {
							...thisFusionContext,
							...valueToApply
						}
					}
				}

				if (partConfiguration.__meta.private && typeof partConfiguration.__meta.private === "object") {
					for (const privateKey in partConfiguration.__meta.private) {
						privateFusionContext[privateKey] = partConfiguration.__meta.private[privateKey]
					}
				}
			}

			for (const key in partConfiguration) {
				if (key.startsWith("__")) continue
				if (hasRenderer && key === "renderer") continue
				thisFusionContext[key] = partConfiguration[key]
			}
			finalFusionContext.this = thisFusionContext
			if (hasRenderer && (rendererNextInPath || atPrivateNextInPath)) {
				finalFusionContext.props = thisFusionContext
				finalFusionContext.private = privateFusionContext
			}
		}

		// console.log("finalFusionContext", finalFusionContext)
		// console.log("pathForNode", pathForNode)
		if (debug) console.log("finalFusionContext", finalFusionContext)

		return finalFusionContext
	}

	public isPrototypeOneOf(prototypeName: string, oneOf: string, workspace: FusionWorkspace) {
		if (prototypeName === oneOf) return true

		const prototypeConfiguration = workspace.mergedArrayTree?.__prototypes?.[prototypeName]
		if (!prototypeConfiguration) return false
		if (prototypeConfiguration.__prototypeObjectName === oneOf) return true
		if (Array.isArray(prototypeConfiguration.__prototypeChain) && prototypeConfiguration.__prototypeChain.includes(oneOf)) return true

		return false
	}

	protected * getAppliedValues(apply: { [key: string]: any }, finalFusionContext: { [key: string]: any }) {
		for (const toApply of Object.values(apply)) {
			// console.log("toApply", toApply)

			const appliedValueFromEelExpression = this.getAppliedValueFromEelExpression(toApply, finalFusionContext)
			if (appliedValueFromEelExpression) yield appliedValueFromEelExpression

			const valueToApplyIsDataStructure = toApply.__objectType === 'Neos.Fusion:DataStructure' || !!toApply.__prototypeChain?.includes('Neos.Fusion:DataStructure')
			if (valueToApplyIsDataStructure) for (const key in toApply) {
				if (key.startsWith('__')) continue
				yield { [key]: toApply[key] }
			}
		}
	}

	protected getAppliedValueFromEelExpression(toApply: any, finalFusionContext: { [key: string]: any }) {
		// TODO: run EEL-Expression
		if (toApply['__eelExpression'] === "props") return finalFusionContext[toApply['__eelExpression']]

		const toApplyEelExpressionValue = toApply.__nodes?.[0]
		if (!(toApplyEelExpressionValue instanceof EelExpressionValue)) return undefined

		const objectNode = toApplyEelExpressionValue.nodes
		if (!(objectNode instanceof ObjectNode)) return undefined

		let currentFusionContext = finalFusionContext
		for (const pathPart of objectNode.path) {
			if (!(pathPart instanceof ObjectPathNode)) return undefined
			if (pathPart.incomplete) return undefined

			if (!(pathPart.value in currentFusionContext)) return undefined
			currentFusionContext = currentFusionContext[pathPart.value]
		}

		return currentFusionContext
	}

	public findPropertyDefinitionSegment(objectNode: ObjectNode | ObjectStatement, workspace?: FusionWorkspace, includeOverwrites = false, debug = false): ExternalObjectStatement | undefined {
		const context = this.getFusionContextUntilNode(objectNode, workspace!, debug)

		if (debug) console.log("context", context)
		let contextEntry = context
		let pathEntry: ObjectPathNode | AbstractPathSegment | undefined = undefined

		if (objectNode instanceof ObjectNode) for (const path of objectNode.path) {
			if (!(path.value in contextEntry)) break

			contextEntry = contextEntry[path.value]
			pathEntry = path
		}
		else for (const path of objectNode.path.segments) {
			if (!(path.identifier in contextEntry)) break

			contextEntry = contextEntry[path.identifier]
			pathEntry = path
		}

		if (!pathEntry) return undefined

		const firstNode = contextEntry.__nodes?.[0]
		if (!firstNode) return undefined

		const entryObjectStatement = findParent(firstNode, ObjectStatement)
		if (!entryObjectStatement) return undefined


		return new ExternalObjectStatement(entryObjectStatement, entryObjectStatement.fileUri ? pathToUri(entryObjectStatement.fileUri) : undefined)
	}

	// TODO: rename findPropertyDefinitionSegments and/or refactor into different methods or Service/Capabilities 
	public * findPropertyDefinitionSegments(objectNode: ObjectStatement, workspace?: FusionWorkspace, includeOverwrites = false): Generator<ExternalObjectStatement | AbstractPathSegment, void, unknown> {
		// console.log("--> findPropertyDefinitionSegments")
		const objectNodeParent = objectNode.parent
		if (!objectNodeParent) return

		const context = this.getFusionContextUntilNode(objectNodeParent, workspace!, false)

		let relevantContext = context.this
		let ignoreKey = objectNode.path.segments[0].identifier

		let segments: AbstractPathSegment[] = []
		const isIncompletePath = objectNode.path.segments.find(segment => segment instanceof IncompletePathSegment) !== undefined

		if (isIncompletePath) {
			segments = objectNode.path.segments.slice(0, -1)
		}

		for (const segment of segments) {
			ignoreKey = segment.identifier
			if (!(segment.identifier in relevantContext)) break

			relevantContext = relevantContext[segment.identifier]
		}

		for (const key in relevantContext) {
			if (key === ignoreKey) continue

			const entry = relevantContext[key]
			if (!entry?.__nodes) continue

			for (const node of entry.__nodes) {
				const objectStatement = findParent(node, ObjectStatement)
				if (!objectStatement) continue

				yield new ExternalObjectStatement(objectStatement, objectStatement.fileUri)
			}
		}

		// console.log("<-- findPropertyDefinitionSegments")
	}
}

const nodeService = new NodeService
export { nodeService as NodeService, NodeService as NodeServiceClass }
