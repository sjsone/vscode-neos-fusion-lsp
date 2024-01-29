import * as NodeFs from "fs"
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { ResourceUriNode } from '../fusion/node/ResourceUriNode'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'

export function diagnoseResourceUris(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const resourceUriNodes = <LinePositionedNode<ResourceUriNode>[]>parsedFusionFile.getNodesByType(ResourceUriNode)
	if (resourceUriNodes === undefined) return diagnostics

	for (const resourceUriNode of resourceUriNodes) {
		const node = resourceUriNode.getNode()
		const uri = parsedFusionFile.workspace.neosWorkspace.getResourceUriPath(node.getNamespace(), node.getRelativePath())
		if (!uri) continue

		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: resourceUriNode.getPositionAsRange(),
			message: ``,
			source: CommonDiagnosticHelper.Source
		}

		if (!node.getNamespace()) continue

		if (!uri && node.getNamespace()) {
			console.log("mode", node)
			diagnostic.message = `Could not resolve package "${node.getNamespace()}"`
			diagnostics.push(diagnostic)
		} else if (!NodeFs.existsSync(uri)) {
			diagnostic.message = `Could not find file "${node.getRelativePath()}"`
			diagnostics.push(diagnostic)
		}
	}

	return diagnostics
}