import { DiagnosticSeverity } from 'vscode-languageserver'
import { DeprecationsDiagnosticLevels } from '../ExtensionConfiguration'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'

export class CommonDiagnosticHelper {
	static Source = "Neos Fusion"

	static getDeprecationsDiagnosticsLevel(parsedFusionFile: ParsedFusionFile): DiagnosticSeverity {
		const severityConfiguration = parsedFusionFile.workspace.getConfiguration().diagnostics.levels.deprecations
	
		if (severityConfiguration === DeprecationsDiagnosticLevels.Info) return DiagnosticSeverity.Information
		if (severityConfiguration === DeprecationsDiagnosticLevels.Warning) return DiagnosticSeverity.Warning
		if (severityConfiguration === DeprecationsDiagnosticLevels.Error) return DiagnosticSeverity.Error
	
		return DiagnosticSeverity.Hint
	}
}