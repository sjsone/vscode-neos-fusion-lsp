import { Diagnostic, DiagnosticRelatedInformation, DiagnosticSeverity, Location } from 'vscode-languageserver'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { NodeService } from '../common/NodeService'
import { getPrototypeNameFromNode } from '../common/util'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'

const isPrototypeOneOf = (prototypeName: string, oneOf: string[], workspace: FusionWorkspace) => {
	for (const name of oneOf) {
		if (NodeService.isPrototypeOneOf(prototypeName, name, workspace)) return true
	}
	return false
}

const contentPrototypeNames = ["Neos.Neos:ContentComponent", "Neos.Neos:Content", "Neos.Neos:Document"]

export function diagnoseNodeTypeDefinitions(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const workspace = parsedFusionFile.workspace

	const neosPackage = workspace.neosWorkspace.getPackageByUri(parsedFusionFile.uri)
	if (!neosPackage) return diagnostics

	const nodeTypeDefinitions = neosPackage["configuration"]["nodeTypeDefinitions"]
	if (nodeTypeDefinitions.length === 0) return diagnostics

	for (const creation of parsedFusionFile.prototypeCreations) {
		const prototypeName = getPrototypeNameFromNode(creation.getNode())

		if (contentPrototypeNames.includes(prototypeName)) continue
		if (!isPrototypeOneOf(prototypeName, contentPrototypeNames, workspace)) continue

		// TODO: implement action to create NodeTypeDefinition (NodeType vs. Configuration Folder...)

		const nodeTypeDefinition = nodeTypeDefinitions.find(nodeType => nodeType.nodeType === prototypeName)
		if (!nodeTypeDefinition) {
			const range = creation.getPositionAsRange()
			const location = Location.create(parsedFusionFile.uri, range)
			diagnostics.push({
				severity: DiagnosticSeverity.Error,
				range: range,
				message: `Could not find NodeType Definition for \`${prototypeName}\``,
				source: CommonDiagnosticHelper.Source,
				relatedInformation: [DiagnosticRelatedInformation.create(location, "test")],
				data: {
					nodeTypeName: prototypeName,
					documentation: {
						openInBrowser: true,
						uri: "https://docs.neos.io/guide/manual/content-repository/nodetype-definition"
					}
				}
			})
		}
	}

	return diagnostics
}