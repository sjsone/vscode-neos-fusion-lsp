import { DiagnosticSeverity, Position, Range } from 'vscode-languageserver'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'

// TODO: make this diagnostic configurable in the settings
export function diagnoseRootFusionConfiguration(parsedFusionFile: ParsedFusionFile) {
	if (!parsedFusionFile.uri.endsWith("/Root.fusion")) return []

	const workspace = parsedFusionFile.workspace

	const neosPackage = workspace.neosWorkspace.getPackageByUri(parsedFusionFile.uri)
	if (!neosPackage) return []

	if (neosPackage["composerJson"]?.type === 'neos-site') return []

	// TODO: Check not only in Package configuration but in the merged configuration ('neos_context' branch)
	const isInAutoInclude = neosPackage["configuration"].get(["Neos", "Neos", "fusion", "autoInclude", neosPackage.getPackageName()]) === true
	if (isInAutoInclude) return []

	return [{
		range: Range.create(Position.create(0, 0), Position.create(0, 1)),
		severity: DiagnosticSeverity.Warning,
		message: `To include this file add the configuration "Neos.Neos.fusion.autoInclude.'${neosPackage.getPackageName()}': true" `,
	}]
}