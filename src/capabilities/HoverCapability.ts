import { FusionObjectValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/FusionObjectValue';
import { PrototypePathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PrototypePathSegment';
import { DefinitionParams } from 'vscode-languageserver/node';
import { AbstractCapability } from './AbstractCapability';

export class HoverCapability extends AbstractCapability {
	public run(params: DefinitionParams) {
		const line = params.position.line + 1
		const column = params.position.character + 1
		this.languageServer.log(`HOVERING: ${line}/${column}`);

		const workspace = this.languageServer.getWorspaceFromFileUri(params.textDocument.uri)
		if (workspace === undefined) return null

		const parsedFile = workspace.getParsedFileByUri(params.textDocument.uri)
		if (parsedFile === undefined) return null

		const foundNodeByLine = parsedFile.getNodeByLineAndColumn(line, column)
		if (foundNodeByLine === undefined) return null
		const nodeBegin = foundNodeByLine.getBegin()
		const nodeEnd = foundNodeByLine.getEnd()

		console.log(`FoundNode: `, foundNodeByLine.getNode())

		const node = foundNodeByLine.getNode()
		if (node instanceof FusionObjectValue) {
			return {
				contents: { kind: "markdown", value: `prototype **${node.value}**` },
				range: { start: { line: nodeBegin.line, character: nodeBegin.column }, end: { line: nodeEnd.line, character: nodeEnd.column } }
			}
		}
		if (node instanceof PrototypePathSegment) {
			return {
				contents: { kind: "markdown", value: `prototype **${node.identifier}**` },
				range: { start: { line: nodeBegin.line, character: nodeBegin.column }, end: { line: nodeEnd.line, character: nodeEnd.column } }
			}
		}

		return null
	}
}