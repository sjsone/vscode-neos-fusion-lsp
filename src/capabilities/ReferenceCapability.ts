import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue'
import { Location, ReferenceParams } from 'vscode-languageserver/node'
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
				const otherNodeBegin = otherNode.getBegin()
				const otherNodeEnd = otherNode.getEnd()

				const targetRange = {
					start: { line: otherNodeBegin.line - 1, character: otherNodeBegin.column - 1 },
					end: { line: otherNodeEnd.line - 1, character: otherNodeEnd.column - 1 }
				}

				locations.push({
					uri: otherParsedFile.uri,
					range: targetRange
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