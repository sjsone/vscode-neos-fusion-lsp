import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement';
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment';
import { RuntimeConfiguration } from 'ts-fusion-runtime';
import { MergedArrayTreeService } from './MergedArrayTreeService';
import { findParent } from './util';
import { FusionWorkspace } from '../fusion/FusionWorkspace';

class NodeService {

	public getFusionContextUntilNode(node: AbstractNode, workspace: FusionWorkspace, debug: boolean = false) {
		const startTimePathResolving = performance.now();

		const baseNode = node instanceof PathSegment ? findParent(node, ObjectStatement)["parent"] : node

		const pathForNode = MergedArrayTreeService.buildPathForNode(baseNode)
		if(debug) console.log("pathForNode", pathForNode)
		const runtimeConfiguration = new RuntimeConfiguration(workspace.mergedArrayTree);
		// if(debug) console.log("runtimeConfiguration", runtimeConfiguration)

		const relevantTree = pathForNode.map((pathPart, index) => ({
			pathPart,
			configuration: runtimeConfiguration.forPath(pathForNode.slice(0, index + 1).join('/'))
		}))

		// console.log(`Elapsed time relevantTree: ${performance.now() - startTimePathResolving} milliseconds`);


		const finalFusionContext = {} as { [key: string]: any }
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
					for (const toApply of Object.values(partConfiguration.__meta.apply)) {
						if (toApply['__eelExpression'] !== "props") continue
						// TODO: run EEL-Expression
						const valueToApply = finalFusionContext[toApply['__eelExpression']]

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
		if(debug) console.log("finalFusionContext", finalFusionContext)

		return finalFusionContext
	}
}


const nodeService = new NodeService
export { NodeService as NodeServiceClass, nodeService as NodeService }
