import { Location, ReferenceParams } from 'vscode-languageserver/node';
import { getPrototypeNameFromNode } from '../util';
import { AbstractCapability } from './AbstractCapability';

export class ReferenceCapability extends AbstractCapability {

	public run(params: ReferenceParams): any {
		const line = params.position.line + 1
		const column = params.position.character + 1
		this.log(`${line}/${column} ${params.textDocument.uri} ${params.workDoneToken}`);

		const workspace = this.languageServer.getWorspaceFromFileUri(params.textDocument.uri)
		if (workspace === undefined) return null

		const parsedFile = workspace.getParsedFileByUri(params.textDocument.uri)
		if (parsedFile === undefined) return null

		const foundNodeByLine = parsedFile.getNodeByLineAndColumn(line, column)
		if (foundNodeByLine === undefined) return null

		this.log(`node type "${foundNodeByLine.getNode().constructor.name}"`)

		const goToPrototypeName = getPrototypeNameFromNode(foundNodeByLine.getNode())
		if (goToPrototypeName === "") return null

		this.log(`goToPrototypeName "${goToPrototypeName}"`)
		const locations: Location[] = []

		for (const otherParsedFile of workspace.parsedFiles) {
			for (const otherNode of otherParsedFile.prototypeExtends) {
				if (otherNode.getNode()["identifier"] !== goToPrototypeName) continue
				const otherNodeBegin = otherNode.getBegin()
				const otherNodeEnd = otherNode.getEnd()

				console.log("otherNode", otherNode, otherParsedFile.uri)

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

}