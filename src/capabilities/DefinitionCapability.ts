import { FusionObjectValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/FusionObjectValue';
import { PrototypePathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PrototypePathSegment';
import { DefinitionLink, DefinitionParams } from 'vscode-languageserver/node';
import { AbstractCapability } from './AbstractCapability';

export class DefinitionCapability extends AbstractCapability {
	public run(params: DefinitionParams) {
		const line = params.position.line + 1
		const column = params.position.character + 1
		this.languageServer.log(`GOTO: ${line}/${column} ${params.textDocument.uri} ${params.workDoneToken}`);

		const workspace = this.languageServer.getWorspaceFromFileUri(params.textDocument.uri)
		if(workspace === undefined) return null

		const parsedFile = workspace.getParsedFileByUri(params.textDocument.uri)
		if (parsedFile === undefined) return null

		const foundNodeByLine = parsedFile.getNodeByLineAndColumn(line, column)
		if(foundNodeByLine === undefined) return null
		const foundNodeByLineBegin = foundNodeByLine.getBegin()
		const foundNodeByLineEnd = foundNodeByLine.getEnd()
		

		this.languageServer.log(`GOTO: node type "${foundNodeByLine.getNode().constructor.name}"`)

		let goToPrototypeName = ''

		// PrototypePathSegment // FusionObjectValue
		if(foundNodeByLine.getNode() instanceof FusionObjectValue) {
			goToPrototypeName = foundNodeByLine.getNode().value
		} else if (foundNodeByLine.getNode() instanceof PrototypePathSegment) {
			goToPrototypeName = foundNodeByLine.getNode().identifier
		}

		if(goToPrototypeName === "") return null

		this.languageServer.log(`GOTO: goToPrototypeName "${goToPrototypeName}"`)
		const locations: DefinitionLink[] = []

		for(const otherParsedFile of workspace.parsedFiles) {
			for(const otherNode of [...otherParsedFile.prototypeCreations, ...otherParsedFile.prototypeOverwrites ]) {
				if(otherNode.getNode()["identifier"] !== goToPrototypeName) continue
				const otherNodeBegin = otherNode.getBegin()
				const otherNodeEnd = otherNode.getEnd()

				const targetRange = {
					start: {line: otherNodeBegin.line-1, character: otherNodeBegin.column-1},
					end: {line: otherNodeEnd.line-1, character: otherNodeEnd.column-1}
				}
				
				locations.push({
					targetUri: otherParsedFile.uri,
					targetRange,
					targetSelectionRange: targetRange,
					originSelectionRange: {
						start: {line: foundNodeByLineBegin.line-1, character: foundNodeByLineBegin.column-1},
						end: {line: foundNodeByLineEnd.line-1, character: foundNodeByLineEnd.column-1}
					}
				})
			}
		}

		return locations
	}
}