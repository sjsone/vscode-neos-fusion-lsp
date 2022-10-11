import { AbstractNode } from 'ts-fusion-parser/out/core/objectTreeParser/ast/AbstractNode';
import { FusionObjectValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/FusionObjectValue';
import { PrototypePathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PrototypePathSegment';
import { DefinitionParams } from 'vscode-languageserver/node';
import { getPrototypeNameFromNode } from '../util';
import { AbstractCapability } from './AbstractCapability';

export class HoverCapability extends AbstractCapability {
	protected getMarkdownByNode(node: AbstractNode) {
		switch (true) {
			case node instanceof FusionObjectValue:
			case node instanceof PrototypePathSegment:
				const prototypeName = getPrototypeNameFromNode(node)
				if (prototypeName === null) return null
				return `prototype **${prototypeName}**`
			default:
				return null
		}
	}

	public run(params: DefinitionParams) {
		const line = params.position.line + 1
		const column = params.position.character + 1
		// this.log(`${line}/${column}`);

		const workspace = this.languageServer.getWorspaceFromFileUri(params.textDocument.uri)
		if (workspace === undefined) return null

		const parsedFile = workspace.getParsedFileByUri(params.textDocument.uri)
		if (parsedFile === undefined) return null

		const foundNodeByLine = parsedFile.getNodeByLineAndColumn(line, column)
		if (foundNodeByLine === undefined) return null
		const nodeBegin = foundNodeByLine.getBegin()
		const nodeEnd = foundNodeByLine.getEnd()

		// console.log(`FoundNode: `, foundNodeByLine.getNode())

		const node = foundNodeByLine.getNode()
		const markdown = this.getMarkdownByNode(node)
		if (markdown === null) return null

		return {
			contents: { kind: "markdown", value: markdown },
			range: {
				start: { line: nodeBegin.line, character: nodeBegin.column },
				end: { line: nodeEnd.line, character: nodeEnd.column }
			}
		}
	}
}