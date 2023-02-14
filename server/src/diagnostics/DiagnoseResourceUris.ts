import * as NodeFs from "fs"
import { OperationNode } from 'ts-fusion-parser/out/dsl/eel/nodes/OperationNode'
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { ResourceUriNode } from '../fusion/ResourceUriNode'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'

function isNodePartOfPlusOperation(node: ResourceUriNode) {
	if(!(node["parent"] instanceof OperationNode)) return false
	return node["parent"].operation === "+"
}

export function diagnoseResourceUris(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const resourceUriNodes = <LinePositionedNode<ResourceUriNode>[]>parsedFusionFile.nodesByType.get(ResourceUriNode)
	if (resourceUriNodes === undefined) return diagnostics

	for (const resourceUriNode of resourceUriNodes) {
		const node = resourceUriNode.getNode()
		const uri = parsedFusionFile.workspace.neosWorkspace.getResourceUriPath(node.getNamespace(), node.getRelativePath())
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: resourceUriNode.getPositionAsRange(),
			message: ``,
			source: CommonDiagnosticHelper.Source
		}
		if (!uri) {
			diagnostic.message = `Could not resolve package "${node.getNamespace()}"`
			diagnostics.push(diagnostic)
		} else if (!NodeFs.existsSync(uri) && !isNodePartOfPlusOperation(node)) {
			diagnostic.message = `Could not find file "${node.getRelativePath()}"`
			diagnostics.push(diagnostic)
		}
	}

	return diagnostics
}