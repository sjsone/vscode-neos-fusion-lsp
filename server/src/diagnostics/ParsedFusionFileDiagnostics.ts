import { Diagnostic } from 'vscode-languageserver'
import { ExtensionConfigurationDiagnostics, LoggingLevel } from '../ExtensionConfiguration'
import { LogService, Logger } from '../common/Logging'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { diagnoseActionUri } from './DiagnoseActionUri'
import { diagnoseEelHelperArguments } from './DiagnoseEelHelperArguments'
import { diagnoseEmptyEel } from './DiagnoseEmptyEel'
import { diagnoseFusionProperties } from './DiagnoseFusionProperties'
import { diagnoseNodeTypeDefinitions } from './DiagnoseNodeTypeDefinitions'
import { diagnoseNonParsedFusion } from './DiagnoseNonParsedFusion'
import { diagnoseParserError } from './DiagnoseParserError'
import { diagnosePrototypeNames } from './DiagnosePrototypeNames'
import { diagnoseResourceUris } from './DiagnoseResourceUris'
import { diagnoseRootFusionConfiguration } from './DiagnoseRootFusionConfiguration'
import { diagnoseTagNames } from './DiagnoseTagNames'
import { diagnoseTranslationShortHand } from './DiagnoseTranslationShortHand'
import { diagnoseAfxWithDollarEel } from './DiagnoseAfxWithDollarEel'
import { diagnoseDuplicateStatements } from './DuplicateStatementDiagnostic'

export class ParsedFusionFileDiagnostics extends Logger {

	protected diagnoseFunctions: Array<(parsedFusionFile: ParsedFusionFile) => Diagnostic[] | Promise<Diagnostic[]>> = []

	constructor(
		protected configuration: ExtensionConfigurationDiagnostics
	) {
		super()

		if (configuration.enabledDiagnostics.FusionProperties) this.diagnoseFunctions.push(diagnoseFusionProperties)
		if (configuration.enabledDiagnostics.ResourceUris) this.diagnoseFunctions.push(diagnoseResourceUris)
		if (configuration.enabledDiagnostics.TagNames) this.diagnoseFunctions.push(diagnoseTagNames)
		if (configuration.enabledDiagnostics.EelHelperArguments) this.diagnoseFunctions.push(diagnoseEelHelperArguments)
		if (configuration.enabledDiagnostics.PrototypeNames) this.diagnoseFunctions.push(diagnosePrototypeNames)
		if (configuration.enabledDiagnostics.EmptyEel) this.diagnoseFunctions.push(diagnoseEmptyEel)
		if (configuration.enabledDiagnostics.ActionUri) this.diagnoseFunctions.push(diagnoseActionUri)
		if (configuration.enabledDiagnostics.NodeTypeDefinitions) this.diagnoseFunctions.push(diagnoseNodeTypeDefinitions)
		if (configuration.enabledDiagnostics.NonParsedFusion) this.diagnoseFunctions.push(diagnoseNonParsedFusion)
		if (configuration.enabledDiagnostics.RootFusionConfiguration) this.diagnoseFunctions.push(diagnoseRootFusionConfiguration)
		if (configuration.enabledDiagnostics.TranslationShortHand) this.diagnoseFunctions.push(diagnoseTranslationShortHand)
		if (configuration.enabledDiagnostics.ParserError) this.diagnoseFunctions.push(diagnoseParserError)
		if (configuration.enabledDiagnostics.AfxWithDollarEel) this.diagnoseFunctions.push(diagnoseAfxWithDollarEel)
		if (configuration.enabledDiagnostics.DuplicateStatements) this.diagnoseFunctions.push(diagnoseDuplicateStatements)

		const enabledDiagnosticsNames = Object.keys(configuration.enabledDiagnostics).filter(name => configuration.enabledDiagnostics[name])

		this.logVerbose(`Enabled Diagnostics: ${enabledDiagnosticsNames.join(", ")}`)
	}

	async diagnose(parsedFusionFile: ParsedFusionFile) {
		const diagnostics: Diagnostic[] = []

		for (const diagnoseFunction of this.diagnoseFunctions) {
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
}