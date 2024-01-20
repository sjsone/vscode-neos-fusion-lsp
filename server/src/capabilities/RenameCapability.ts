import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { TextDocumentEdit, TextEdit } from 'vscode-languageserver'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { getPrototypeNameFromNode } from '../common/util'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { AbstractCapability } from './AbstractCapability'
import { ParsedFileCapabilityContext } from './CapabilityContext'
import { RenamePrepareCapability } from './RenamePrepareCapability'



export class RenameCapability extends AbstractCapability {
	protected run<N extends AbstractNode>(capabilityContext: ParsedFileCapabilityContext<N>) {
		console.log("RenameCapability", capabilityContext.foundNodeByLine)

		const node = capabilityContext.foundNodeByLine!.getNode()
		if (!RenamePrepareCapability.canNodeBeRenamed(node)) return undefined

		const textDocumentEdits = this.renamePrototypeName((capabilityContext.params as any).newName, <any>capabilityContext.foundNodeByLine!, capabilityContext.workspace)
		if (textDocumentEdits.length === 0) return undefined

		return {
			documentChanges: textDocumentEdits
		}
	}

	protected renamePrototypeName(newName: string, foundNodeByLine: LinePositionedNode<PrototypePathSegment | FusionObjectValue>, workspace: FusionWorkspace) {
		const textDocumentEdits: TextDocumentEdit[] = []

		const goToPrototypeName = getPrototypeNameFromNode(foundNodeByLine.getNode())
		if (goToPrototypeName === "") {
			this.logDebug("No PrototypeName found for this node")
			return textDocumentEdits
		}

		function* getNodesOfOtherParsedFile(otherParsedFile: ParsedFusionFile) {
			const pathSegments = otherParsedFile.getNodesByType(PrototypePathSegment)
			if (pathSegments) for (const node of pathSegments) yield node

			const objectValues = otherParsedFile.getNodesByType(FusionObjectValue)
			if (objectValues) for (const node of objectValues) yield node
		}

		for (const otherParsedFile of workspace.parsedFiles) {
			const textEdits: TextEdit[] = []
			for (const otherNode of getNodesOfOtherParsedFile(otherParsedFile)) {
				if (getPrototypeNameFromNode(otherNode.getNode()) !== goToPrototypeName) continue
				textEdits.push(TextEdit.replace(otherNode.getPositionAsRange(), newName))
			}
			if (textEdits.length === 0) continue

			textDocumentEdits.push(TextDocumentEdit.create({ uri: otherParsedFile.uri, version: null }, textEdits))
		}

		return textDocumentEdits
	}
}