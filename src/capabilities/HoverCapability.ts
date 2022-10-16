import { AbstractNode } from 'ts-fusion-parser/out/core/objectTreeParser/ast/AbstractNode';
import { FusionObjectValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/FusionObjectValue';
import { PathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PathSegment';
import { PrototypePathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PrototypePathSegment';
import { DefinitionParams } from 'vscode-languageserver/node';
import { EelHelperMethodNode } from '../fusion/EelHelperMethodNode';
import { EelHelperNode } from '../fusion/EelHelperNode';
import { FusionWorkspace } from '../FusionWorkspace';
import { getPrototypeNameFromNode } from '../util';
import { AbstractCapability } from './AbstractCapability';

export class HoverCapability extends AbstractCapability {
	protected getMarkdownByNode(node: AbstractNode, workspace: FusionWorkspace) {
		switch (true) {
			case node instanceof FusionObjectValue:
			case node instanceof PrototypePathSegment:
				const prototypeName = getPrototypeNameFromNode(node)
				if (prototypeName === null) return null
				return `prototype **${prototypeName}**`
			case node instanceof PathSegment:
				return `property **${node["identifier"]}**`
			case node instanceof EelHelperNode:
				return `EEL-Helper **${(<EelHelperNode>node).identifier}**`
			case node instanceof EelHelperMethodNode:
				let description = undefined
				node = <EelHelperMethodNode>node

				const eelHelper = workspace.neosWorkspace.getEelHelperFileUriByName((<EelHelperMethodNode>node).eelHelper.identifier)
				if(eelHelper) {
					const method = eelHelper.methods.find(method => '.'+method.name === (<EelHelperMethodNode>node).identifier)
					if(method) description = method.description
				}

				const header = `EEL-Helper *${(<EelHelperMethodNode>node).eelHelper.identifier}***${(<EelHelperMethodNode>node).identifier}**`

				return `${header}` + (description ? '\n\n'+description : '')
			default:
				return null // `Type: ${node.constructor.name}`
		}
	}

	public run(params: DefinitionParams) {
		const line = params.position.line + 1
		const column = params.position.character + 1

		const workspace = this.languageServer.getWorspaceFromFileUri(params.textDocument.uri)
		if (workspace === undefined) return null

		const parsedFile = workspace.getParsedFileByUri(params.textDocument.uri)
		if (parsedFile === undefined) return null

		const foundNodeByLine = parsedFile.getNodeByLineAndColumn(line, column)
		if (foundNodeByLine === undefined) return null

		const nodeBegin = foundNodeByLine.getBegin()
		const nodeEnd = foundNodeByLine.getEnd()

		const node = foundNodeByLine.getNode()
		this.log(`FoundNode: ` + node.constructor.name)

		const markdown = this.getMarkdownByNode(node, workspace)
		if (markdown === null) return null

		return {
			contents: { kind: "markdown", value: markdown },
			range: {
				start: { line: nodeBegin.line-1, character: nodeBegin.column-1 },
				end: { line: nodeEnd.line-1, character: nodeEnd.column-1 }
			}
		}
	}
}