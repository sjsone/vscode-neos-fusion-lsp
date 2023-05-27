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
import { LogService, Logger } from '../common/Logging';
import { LoggingLevel } from '../ExtensionConfiguration';
import { diagnoseRootFusionConfiguration } from './DiagnoseRootFusionConfiguration';

export async function diagnose(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const diagnoseFunctions = [
		diagnoseFusionProperties,
		diagnoseResourceUris,
		diagnoseTagNames,
		diagnoseEelHelperArguments,
		diagnosePrototypeNames,
		diagnoseEmptyEel,
		diagnoseActionUri,
		diagnoseNodeTypeDefinitions,
		diagnoseNonParsedFusion,
		diagnoseRootFusionConfiguration,
	]

	for (const diagnoseFunction of diagnoseFunctions) {
		try {
			diagnostics.push(...diagnoseFunction(parsedFusionFile))
		} catch (error) {
			if (LogService.isLogLevel(LoggingLevel.Verbose)) {
				Logger.LogNameAndLevel(LoggingLevel.Verbose.toUpperCase(), `ParsedFusionFileDiagnostics:${diagnoseFunction.name}`, 'ERROR:', error)
			}
		}
	}

	return diagnostics
}