import { Diagnostic } from 'vscode-languageserver';
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

	return diagnostics
}