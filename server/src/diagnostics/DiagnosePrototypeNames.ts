import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { Diagnostic, DiagnosticTag } from 'vscode-languageserver'
import { isPrototypeDeprecated } from '../common/util'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'

export function diagnosePrototypeNames(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const severity = CommonDiagnosticHelper.getDeprecationsDiagnosticsLevel(parsedFusionFile)

	const pathSegments = parsedFusionFile.getNodesByType(PrototypePathSegment)
	if (pathSegments !== undefined) {
		for (const positionedPathSegment of pathSegments) {
			const node = positionedPathSegment.getNode()
			const range = positionedPathSegment.getPositionAsRange()

			if (!node.identifier.includes(":")) {
				diagnostics.push({
					severity,
					range,
					tags: [DiagnosticTag.Deprecated],
					message: `A prototype without a namespace is deprecated`,
					source: CommonDiagnosticHelper.Source
				})
			}

			if (isPrototypeDeprecated(parsedFusionFile.workspace, node.identifier)) {
				diagnostics.push({
					severity,
					range,
					tags: [DiagnosticTag.Deprecated],
					message: `Prototype ${node.identifier} is deprecated`,
					source: CommonDiagnosticHelper.Source
				})
			}
		}
	}

	const fusionObjectValues = parsedFusionFile.getNodesByType(FusionObjectValue)
	if (fusionObjectValues !== undefined) {
		for (const fusionObjectValue of fusionObjectValues) {
			const node = fusionObjectValue.getNode()
			const range = fusionObjectValue.getPositionAsRange()

			if (!node.value.includes(":")) {
				diagnostics.push({
					severity,
					range,
					message: `Using a prototype without a namespace should be avoided`,
					source: CommonDiagnosticHelper.Source
				})
			}

			const deprecated = isPrototypeDeprecated(parsedFusionFile.workspace, node.value)
			if (deprecated !== false) {
				diagnostics.push({
					severity,
					range,
					tags: [DiagnosticTag.Deprecated],
					message: `Prototype ${node.value} is deprecated.${deprecated !== true ? ` Use ${deprecated} instead.` : ''}`,
					source: CommonDiagnosticHelper.Source,
					data: {
						deprecatedName: node.value,
						newName: deprecated
					}
				})
			}
		}
	}

	return diagnostics
}