import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { NodeTypeDefinition } from '../neos/FlowConfiguration'
import { LinePositionedNode } from './LinePositionedNode'
import { getPrototypeNameFromNode } from './util'

class NodeTypeService {
	public getNodeTypeDefinitionsFromFusionFile(workspace: FusionWorkspace, parsedFile: ParsedFusionFile) {
		const neosPackage = workspace.neosWorkspace.getPackageByUri(parsedFile.uri)
		if (!neosPackage) return []

		const nodeTypeDefinitions = neosPackage.configuration.nodeTypeDefinitions
		if (nodeTypeDefinitions.length === 0) return []

		const definitions: {
			creation: LinePositionedNode<PrototypePathSegment>, nodeTypeDefinition: NodeTypeDefinition
		}[] = []

		for (const creation of parsedFile.prototypeCreations) {
			const prototypeName = getPrototypeNameFromNode(creation.getNode())
			const nodeTypeDefinition = nodeTypeDefinitions.find(nodeType => nodeType.nodeType === prototypeName)
			if (!nodeTypeDefinition) continue

			definitions.push({ creation, nodeTypeDefinition })
		}

		return definitions
	}
}

const nodeTypeService = new NodeTypeService
export { NodeTypeService as NodeTypeServiceClass, nodeTypeService as NodeTypeService }
