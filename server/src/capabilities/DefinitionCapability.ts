import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue'
import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment'
import { DefinitionLink, Location } from 'vscode-languageserver/node'
import { EelHelperMethodNode } from '../fusion/EelHelperMethodNode'
import { EelHelperNode } from '../fusion/EelHelperNode'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { LinePositionedNode } from '../LinePositionedNode'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { getPrototypeNameFromNode } from '../util'
import { AbstractCapability } from './AbstractCapability'
import { ObjectPathNode } from 'ts-fusion-parser/out/eel/nodes/ObjectPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/eel/nodes/ObjectNode'
import { NodeService } from '../NodeService'
import { CapabilityContext } from './CapabilityContext'
import { AbstractNode } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/AbstractNode'

export class DefinitionCapability extends AbstractCapability {

	protected run(context: CapabilityContext<AbstractNode>) {
		const { workspace, parsedFile, foundNodeByLine } = context
		const node = foundNodeByLine.getNode()

		this.logVerbose(`node type "${foundNodeByLine.getNode().constructor.name}"`)
		switch (true) {
			case node instanceof FusionObjectValue:
			case node instanceof PrototypePathSegment:
				return this.getPrototypeDefinitions(workspace, foundNodeByLine)
			case node instanceof PathSegment:
			case node instanceof ObjectPathNode:
				return this.getPropertyDefinitions(parsedFile, workspace, foundNodeByLine)
			case node instanceof EelHelperMethodNode:
				return this.getEelHelperMethodDefinitions(workspace, <LinePositionedNode<EelHelperMethodNode>>foundNodeByLine)
			case node instanceof EelHelperNode:
				return this.getEelHelperDefinitions(workspace, <LinePositionedNode<EelHelperNode>>foundNodeByLine)
		}

		return null
	}

	getPrototypeDefinitions(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<any>) {
		const goToPrototypeName = getPrototypeNameFromNode(foundNodeByLine.getNode())
		if (goToPrototypeName === "") return null

		const locations: DefinitionLink[] = []

		for (const otherParsedFile of workspace.parsedFiles) {
			for (const otherNode of [...otherParsedFile.prototypeCreations, ...otherParsedFile.prototypeOverwrites]) {
				if (otherNode.getNode()["identifier"] !== goToPrototypeName) continue

				locations.push({
					targetUri: otherParsedFile.uri,
					targetRange: otherNode.getPositionAsRange(),
					targetSelectionRange: otherNode.getPositionAsRange(),
					originSelectionRange: foundNodeByLine.getPositionAsRange()
				})
			}
		}

		return locations
	}

	getPropertyDefinitions(parsedFile: ParsedFusionFile, workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<any>): null | Location[] {
		const node = <PathSegment | ObjectPathNode>foundNodeByLine.getNode()
		const objectNode = node["parent"]
		if (!(objectNode instanceof ObjectNode)) return null

		if ((objectNode.path[0]["value"] !== "this" && objectNode.path[0]["value"] !== "props") || objectNode.path.length === 1) {
			// TODO: handle context properties
			return null
		}

		const segment = NodeService.findPropertyDefinitionSegment(objectNode, workspace)
		if (segment) {
			if (segment instanceof PathSegment) {
				return [{
					uri: parsedFile.uri,
					range: LinePositionedNode.Get(segment).getPositionAsRange()
				}]
			} else {
				return [{
					uri: segment.uri,
					range: LinePositionedNode.Get(segment.statement.path.segments[0]).getPositionAsRange()
				}]
			}
		}

		return null
	}

	getEelHelperDefinitions(workspace: FusionWorkspace, foundNodeByLine: LinePositionedNode<EelHelperNode>) {
		const node = foundNodeByLine.getNode()
		for (const eelHelper of workspace.neosWorkspace.getEelHelperTokens()) {
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
		this.logVerbose(`Trying to find ${node.eelHelper.identifier}${node.identifier}`)
		for (const eelHelper of workspace.neosWorkspace.getEelHelperTokens()) {
			if (eelHelper.name === node.eelHelper.identifier) {
				const method = eelHelper.methods.find(method => method.valid(node.identifier))
				if (!method) continue
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