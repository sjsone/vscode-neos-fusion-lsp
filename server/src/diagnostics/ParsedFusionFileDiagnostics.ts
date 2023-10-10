import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { LoggingLevel } from '../ExtensionConfiguration';
import { LogService, Logger } from '../common/Logging';
import { ParsedFusionFile } from '../fusion/ParsedFusionFile';
import { diagnoseActionUri } from './DiagnoseActionUri';
import { diagnoseEelHelperArguments } from './DiagnoseEelHelperArguments';
import { diagnoseEmptyEel } from './DiagnoseEmptyEel';
import { diagnoseFusionProperties } from './DiagnoseFusionProperties';
import { diagnoseNodeTypeDefinitions } from './DiagnoseNodeTypeDefinitions';
import { diagnoseNonParsedFusion } from './DiagnoseNonParsedFusion';
import { diagnoseParserError } from './DiagnoseParserError';
import { diagnosePrototypeNames } from './DiagnosePrototypeNames';
import { diagnoseResourceUris } from './DiagnoseResourceUris';
import { diagnoseRootFusionConfiguration } from './DiagnoseRootFusionConfiguration';
import { diagnoseTagNames } from './DiagnoseTagNames';
import { diagnoseTranslationShortHand } from './DiagnoseTranslationShortHand';
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue';
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper';

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
		diagnoseTranslationShortHand,
		diagnoseParserError
	]

	for (const diagnoseFunction of diagnoseFunctions) {
		try {
			diagnostics.push(...await diagnoseFunction(parsedFusionFile))
		} catch (error) {
			if (LogService.isLogLevel(LoggingLevel.Verbose)) {
				Logger.LogNameAndLevel(LoggingLevel.Verbose.toUpperCase(), `ParsedFusionFileDiagnostics:${diagnoseFunction.name}`, 'ERROR:', error)
			}
		}
	}

	return diagnostics
}