import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode';
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement';
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment';
import { RuntimeConfiguration } from 'ts-fusion-runtime';
import { FusionWorkspace } from '../fusion/FusionWorkspace';
import { MergedArrayTreeService } from './MergedArrayTreeService';
import { findParent } from './util';

class NodeService {

	public getFusionContextUntilNode(node: AbstractNode, workspace: FusionWorkspace, debug: boolean = false) {
		const startTimePathResolving = performance.now();

		const baseNode = node instanceof PathSegment ? findParent(node, ObjectStatement)["parent"] : node

		if (debug) console.log("before buildPathForNode")
		const pathForNode = MergedArrayTreeService.buildPathForNode(baseNode)
		if (debug) console.log("pathForNode", pathForNode)
		const runtimeConfiguration = new RuntimeConfiguration(workspace.mergedArrayTree);
		// if(debug) console.log("runtimeConfiguration", runtimeConfiguration)

		const relevantTree = pathForNode.map((pathPart, index) => {

			return {
				pathPart,
				configuration: runtimeConfiguration.forPath(pathForNode.slice(0, index + 1).join('/'))
			}
		})
		if (debug) console.log("relevantTree", relevantTree)

		// console.log(`Elapsed time relevantTree: ${performance.now() - startTimePathResolving} milliseconds`);


		const finalFusionContext = {
			site: null,
			documentNode: null,
			node: null
		} as { [key: string]: any }
		for (const relevantTreePart of relevantTree) {
			const partConfiguration = relevantTreePart.configuration
			if ('__eelExpression' in partConfiguration && partConfiguration.__eelExpression !== null) continue

			const hasRenderer = partConfiguration.__objectType === 'Neos.Fusion:Component' || partConfiguration.__prototypeChain?.includes('Neos.Fusion:Component')

			let thisFusionContext = {}

			if (partConfiguration.__meta) {
				if (partConfiguration.__meta.context && typeof partConfiguration.__meta.context === "object") {
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
			}

			for (const key in partConfiguration) {
				if (key.startsWith("__")) continue
				if (hasRenderer && key === "renderer") continue
				thisFusionContext[key] = partConfiguration[key]
			}
			finalFusionContext.this = thisFusionContext
			if (hasRenderer) finalFusionContext.props = thisFusionContext
		}

		// console.log("finalFusionContext", finalFusionContext)
		// console.log("pathForNode", pathForNode)
		if (debug) console.log("finalFusionContext", finalFusionContext)

		return finalFusionContext
	}

	public isPrototypeOneOf(prototypeName: string, oneOf: string, workspace: FusionWorkspace) {
		// TODO: cache
		if (prototypeName === oneOf) return true

		const prototypeConfiguration = workspace.mergedArrayTree?.__prototypes?.[prototypeName]
		if (!prototypeConfiguration) return false
		if (prototypeConfiguration['__prototypeObjectName'] === oneOf) return true
		if (Array.isArray(prototypeConfiguration['__prototypeChain']) && prototypeConfiguration['__prototypeChain'].includes(oneOf)) return true

		return false
	}

	protected * getAppliedValues(apply: { [key: string]: any }, finalFusionContext: { [key: string]: any }) {
		for (const toApply of Object.values(apply)) {
			// TODO: run EEL-Expression or at least handle things like `@apply.baseAttributes = ${props.baseAttributes}` 
			if (toApply['__eelExpression'] === "props") yield finalFusionContext[toApply['__eelExpression']]

			const valueToApplyIsDataStructure = toApply.__objectType === 'Neos.Fusion:DataStructure' || !!toApply.__prototypeChain?.includes('Neos.Fusion:DataStructure')
			if (valueToApplyIsDataStructure) for (const key in toApply) {
				if (key.startsWith('__')) continue
				yield { [key]: toApply[key] }
			}
		}
	}
}


const nodeService = new NodeService
export { nodeService as NodeService, NodeService as NodeServiceClass };

