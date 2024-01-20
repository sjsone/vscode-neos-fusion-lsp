import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import { XLIFFService } from '../common/XLIFFService'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { TranslationShortHandNode } from '../fusion/node/TranslationShortHandNode'
import { IgnorableDiagnostic } from './IgnorableDiagnostic'
import { NodeService } from '../common/NodeService'

export async function diagnoseTranslationShortHand(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []
	const workspace = parsedFusionFile.neosPackage.neosWorkspace.fusionWorkspace
	const translationShortHandNodes = parsedFusionFile.getNodesByType(TranslationShortHandNode)
	if (translationShortHandNodes === undefined) return diagnostics

	for (const translationShortHandNode of translationShortHandNodes) {
		const node = translationShortHandNode.getNode()
		const identifier = XLIFFService.readShortHandIdentifier(node.getValue())
		const translationFiles = await XLIFFService.getMatchingTranslationFiles(workspace, identifier)
		if (translationFiles.length > 0) continue

		if (NodeService.isNodeAffectedByIgnoreComment(node, parsedFusionFile)) continue

		diagnostics.push(IgnorableDiagnostic.create(translationShortHandNode.getPositionAsRange(), `Unknown Translation ID ${node.getValue()}`, DiagnosticSeverity.Error))
	}

	return diagnostics
}