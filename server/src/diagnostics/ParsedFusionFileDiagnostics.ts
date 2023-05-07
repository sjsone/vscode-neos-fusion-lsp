import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { ParsedFusionFile } from '../fusion/ParsedFusionFile';
import { diagnoseFusionProperties } from './DiagnoseFusionProperties';
import { diagnoseActionUri } from './DiagnoseActionUri';
import { diagnoseEelHelperArguments } from './DiagnoseEelHelperArguments';
import { diagnoseEmptyEel } from './DiagnoseEmptyEel';
import { diagnosePrototypeNames } from './DiagnosePrototypeNames';
import { diagnoseResourceUris } from './DiagnoseResourceUris';
import { diagnoseTagNames } from './DiagnoseTagNames';
import { diagnoseNodeTypeDefinitions } from './DiagnoseNodeTypeDefinitions';
import { diagnoseNonParsedFusion } from './DiagnoseNonParsedFusion';
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue';
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper';

export async function diagnose(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	diagnostics.push(...diagnoseFusionProperties(parsedFusionFile))
	diagnostics.push(...diagnoseResourceUris(parsedFusionFile))
	diagnostics.push(...diagnoseTagNames(parsedFusionFile))
	diagnostics.push(...diagnoseEelHelperArguments(parsedFusionFile))
	diagnostics.push(...diagnosePrototypeNames(parsedFusionFile))
	diagnostics.push(...diagnoseEmptyEel(parsedFusionFile))
	diagnostics.push(...diagnoseActionUri(parsedFusionFile))
	diagnostics.push(...diagnoseNodeTypeDefinitions(parsedFusionFile))
	diagnostics.push(...diagnoseNonParsedFusion(parsedFusionFile))
	diagnostics.push(...documentationHint(parsedFusionFile))

	return diagnostics
}

function documentationHint(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const fusionObjectValues = parsedFusionFile.getNodesByType(FusionObjectValue)
	if (!fusionObjectValues) return diagnostics

	for (const fusionObjectValue of fusionObjectValues) {
		const fusionObjectValueName = fusionObjectValue.getNode()["value"]

		diagnostics.push({
			range: fusionObjectValue.getPositionAsRange(),
			severity: DiagnosticSeverity.Hint,
			source: CommonDiagnosticHelper.Source,
			message: `Show NEOS Documentation for "${fusionObjectValueName}"`,
			data: {
				openDocumentation: true,
			}
		})
	}

	return diagnostics
}