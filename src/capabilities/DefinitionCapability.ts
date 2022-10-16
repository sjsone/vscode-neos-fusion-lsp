import { FusionObjectValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/FusionObjectValue';
import { PathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PathSegment';
import { PrototypePathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PrototypePathSegment';
import { DefinitionLink, DefinitionParams, Location } from 'vscode-languageserver/node';
import { EelHelperMethodNode } from '../fusion/EelHelperMethodNode';
import { EelHelperNode } from '../fusion/EelHelperNode';
import { FusionWorkspace } from '../FusionWorkspace';
import { LinePositionedNode } from '../LinePositionedNode';
import { ParsedFile } from '../ParsedFile';
import { getPrototypeNameFromNode } from '../util';
import { AbstractCapability } from './AbstractCapability';

export class DefinitionCapability extends AbstractCapability {

	public run(params: DefinitionParams) {
		const line = params.position.line + 1
		const column = params.position.character + 1
		this.log(`${line}/${column} ${params.textDocument.uri} ${params.workDoneToken}`);

		const workspace = this.languageServer.getWorspaceFromFileUri(params.textDocument.uri)
		if (workspace === undefined) return null

		const parsedFile = workspace.getParsedFileByUri(params.textDocument.uri)
		if (parsedFile === undefined) return null

		const foundNodeByLine = parsedFile.getNodeByLineAndColumn(line, column)
		if (foundNodeByLine === undefined) return null

		
		const node = foundNodeByLine.getNode()
		this.log(`node type "${foundNodeByLine.getNode().constructor.name}"`)
		switch (true) {
			case node instanceof FusionObjectValue:
			case node instanceof PrototypePathSegment:
				return this.getPrototypeDefinitions(workspace, foundNodeByLine)
			case node instanceof PathSegment:
				return this.getPropertyDefinitions(parsedFile, foundNodeByLine)
			case node instanceof EelHelperMethodNode:
				return this.getEelHelperMethodDefinitions(workspace, foundNodeByLine)
			case node instanceof EelHelperNode:
				return this.getEelHelperDefinitions(workspace, foundNodeByLine)
		}

		return null
	}

	getPrototypeDefinitions(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<any>) {
		const foundNodeByLineBegin = foundNodeByLine.getBegin()
		const foundNodeByLineEnd = foundNodeByLine.getEnd()

		const goToPrototypeName = getPrototypeNameFromNode(foundNodeByLine.getNode())
		if (goToPrototypeName === "") return null

		const locations: DefinitionLink[] = []

		for (const otherParsedFile of workspace.parsedFiles) {
			for (const otherNode of [...otherParsedFile.prototypeCreations, ...otherParsedFile.prototypeOverwrites]) {
				if (otherNode.getNode()["identifier"] !== goToPrototypeName) continue
				const otherNodeBegin = otherNode.getBegin()
				const otherNodeEnd = otherNode.getEnd()

				const targetRange = {
					start: { line: otherNodeBegin.line - 1, character: otherNodeBegin.column - 1 },
					end: { line: otherNodeEnd.line - 1, character: otherNodeEnd.column - 1 }
				}

				locations.push({
					targetUri: otherParsedFile.uri,
					targetRange,
					targetSelectionRange: targetRange,
					originSelectionRange: {
						start: { line: foundNodeByLineBegin.line - 1, character: foundNodeByLineBegin.column - 1 },
						end: { line: foundNodeByLineEnd.line - 1, character: foundNodeByLineEnd.column - 1 }
					}
				})
			}
		}

		return locations
	}

	getPropertyDefinitions(parsedFile: ParsedFile, foundNodeByLine: LinePositionedNode<PathSegment>) {
		const locations: Location[] = []

		const pathSegments = parsedFile.getNodesByType(PathSegment)
		if (pathSegments === undefined) return null

		for (const pathSegment of pathSegments) {
			if (pathSegment.getNode().identifier !== foundNodeByLine.getNode().identifier) continue
			if (pathSegment.getNode() === foundNodeByLine.getNode()) continue
			// Skip if it occours multiple times in one line. Happens in AFX quite a lot
			if (pathSegment.getBegin().line === foundNodeByLine.getBegin().line) continue

			locations.push({
				uri: parsedFile.uri,
				range: {
					start: { line: pathSegment.getBegin().line - 1, character: pathSegment.getBegin().column - 1 },
					end: { line: pathSegment.getEnd().line - 1, character: pathSegment.getEnd().column - 1 }
				}
			})
		}

		return locations
	}

	getEelHelperDefinitions(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<EelHelperNode>) {
		const node = foundNodeByLine.getNode()
		for (const eelHelper of workspace.neosWorkspace.getEelHelperFileUris()) {
			if (eelHelper.name === node.identifier) {
				return [
					{
						uri: eelHelper.uri,
						range: {
							start: { line: eelHelper.position.begin.line - 1, character: eelHelper.position.begin.column - 1 },
							end: { line: eelHelper.position.end.line - 1, character: eelHelper.position.end.column - 1 }
						}
					}
				]
			}
		}

		return null
	}

	getEelHelperMethodDefinitions(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<EelHelperMethodNode>) {
		const node = foundNodeByLine.getNode()

		for (const eelHelper of workspace.neosWorkspace.getEelHelperFileUris()) {
			if (eelHelper.name === node.eelHelper.identifier) {
				const method = eelHelper.methods.find(method => '.'+method.name === node.identifier)
				if(!method) continue

				return [
					{
						uri: eelHelper.uri,
						range: {
							start: { line: method.position.begin.line - 1, character: method.position.begin.column - 1 },
							end: { line: method.position.end.line - 1, character: method.position.end.column - 1 }
						}
					}
				]
			}
		}

		return null
	}
}