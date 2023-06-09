import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { TranslationShortHandNode } from '../fusion/TranslationShortHandNode'
import { XLIFFService } from '../common/XLIFFService'

export async function diagnoseTranslationShortHand(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []
	const workspace = parsedFusionFile.neosPackage["neosWorkspace"]["fusionWorkspace"]
	const translationShortHandNodes = parsedFusionFile.getNodesByType(TranslationShortHandNode)
	if (translationShortHandNodes === undefined) return diagnostics

	for (const translationShortHandNode of translationShortHandNodes) {
		const identifier = XLIFFService.readShortHandIdentifier(translationShortHandNode.getNode().getValue())
		const translationFiles = await XLIFFService.getMatchingTranslationFiles(workspace, identifier)
		if(translationFiles.length > 0) continue

		diagnostics.push({
			range: translationShortHandNode.getPositionAsRange(),
			severity: DiagnosticSeverity.Error,
			message: `Unknown ID ${translationShortHandNode.getNode().getValue()}`
		})
	}

	return diagnostics
}