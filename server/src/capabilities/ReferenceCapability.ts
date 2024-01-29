import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { Location } from 'vscode-languageserver/node'
import { getPrototypeNameFromNode } from '../common/util'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext'

export class ReferenceCapability extends AbstractCapability {

	protected run(context: CapabilityContext<AbstractNode>): any {
		const { workspace, foundNodeByLine } = <ParsedFileCapabilityContext<AbstractNode>>context
		if (!foundNodeByLine) return null

		const node = foundNodeByLine.getNode()
		this.logVerbose(`Found node type "${node.constructor.name}"`)

		const prototypeName = getPrototypeNameFromNode(node)
		if (prototypeName) return this.getPrototypeReferencesByName(workspace, prototypeName)

		return null
	}

	protected getPrototypeReferencesByName(workspace: FusionWorkspace, name: string) {
		this.logDebug(`prototypeName "${name}"`)

		const locations: Location[] = []

		for (const otherParsedFile of workspace.parsedFiles) {
			for (const nodeType of [PrototypePathSegment, FusionObjectValue]) {
				const otherNodes = otherParsedFile.getNodesByType(<any>nodeType) ?? []
				for (const otherNode of otherNodes) {
					if (getPrototypeNameFromNode(otherNode.getNode()) !== name) continue
					locations.push({
						uri: otherParsedFile.uri,
						range: otherNode.getPositionAsRange()
					})
				}
			}
		}

		return locations
	}
}