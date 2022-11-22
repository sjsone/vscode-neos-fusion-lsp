import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue'
import { Location } from 'vscode-languageserver/node'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { getPrototypeNameFromNode } from '../util'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext } from './CapabilityContext'

export class ReferenceCapability extends AbstractCapability {

	protected run(context: CapabilityContext<any>): any {
		const { workspace, foundNodeByLine } = context

		this.logVerbose(`Found node type "${foundNodeByLine.getNode().constructor.name}"`)

		const goToPrototypeName = getPrototypeNameFromNode(foundNodeByLine.getNode())
		if (goToPrototypeName === "") return null

		this.logVerbose(`goToPrototypeName "${goToPrototypeName}"`)
		const locations: Location[] = []

		for (const otherParsedFile of workspace.parsedFiles) {
			for (const otherNode of this.getOtherNodesFromOtherParsedFile(otherParsedFile)) {
				if (getPrototypeNameFromNode(otherNode.getNode()) !== goToPrototypeName) continue

				locations.push({
					uri: otherParsedFile.uri,
					range: otherNode.getPositionAsRange()
				})
			}
		}

		return locations
	}

	protected getOtherNodesFromOtherParsedFile(otherParsedFile: ParsedFusionFile) {
		const fusionObjectValues = otherParsedFile.getNodesByType(FusionObjectValue) || []
		return [...otherParsedFile.prototypeExtends, ...fusionObjectValues]
	}

}