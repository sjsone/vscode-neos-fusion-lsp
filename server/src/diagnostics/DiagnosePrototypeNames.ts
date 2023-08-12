import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { Diagnostic, DiagnosticSeverity, DiagnosticTag } from 'vscode-languageserver'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { isPrototypeDeprecated } from '../common/util'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'

function* getDiagnosticsFromPathSegments(pathSegments: LinePositionedNode<PrototypePathSegment>[], severity: DiagnosticSeverity, parsedFusionFile: ParsedFusionFile) {
	for (const positionedPathSegment of pathSegments) {
		const node = positionedPathSegment.getNode()
		const range = positionedPathSegment.getPositionAsRange()

		if (!node.identifier.includes(":")) yield {
			severity,
			range,
			tags: [DiagnosticTag.Deprecated],
			message: `A prototype without a namespace is deprecated`,
			source: CommonDiagnosticHelper.Source
		}

		if (isPrototypeDeprecated(parsedFusionFile.workspace, node.identifier)) yield {
			severity,
			range,
			tags: [DiagnosticTag.Deprecated],
			message: `Prototype ${node.identifier} is deprecated`,
			source: CommonDiagnosticHelper.Source
		}
	}
}

function* getDiagnosticsFromFusionObjectValues(fusionObjectValues: LinePositionedNode<FusionObjectValue>[], severity: DiagnosticSeverity, parsedFusionFile: ParsedFusionFile) {
	for (const fusionObjectValue of fusionObjectValues) {
		const node = fusionObjectValue.getNode()
		const range = fusionObjectValue.getPositionAsRange()

		if (!node.value.includes(":")) yield {
			severity,
			range,
			message: `Using a prototype without a namespace should be avoided`,
			source: CommonDiagnosticHelper.Source
		}

		const deprecated = isPrototypeDeprecated(parsedFusionFile.workspace, node.value)
		if (deprecated === false) continue

		const replacingPrototypeMessage = deprecated !== true ? ` Use ${deprecated} instead.` : ''

		yield {
			severity,
			range,
			tags: [DiagnosticTag.Deprecated],
			message: `Prototype ${node.value} is deprecated.${replacingPrototypeMessage}`,
			source: CommonDiagnosticHelper.Source,
			data: {
				deprecatedName: node.value,
				newName: deprecated
			}
		}
	}
}

export function diagnosePrototypeNames(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const severity = CommonDiagnosticHelper.getDeprecationsDiagnosticsLevel(parsedFusionFile)

	const pathSegments = parsedFusionFile.getNodesByType(PrototypePathSegment)
	if (pathSegments !== undefined) {
		for (const diagnostic of getDiagnosticsFromPathSegments(pathSegments, severity, parsedFusionFile)) {
			diagnostics.push(diagnostic)
		}
	}

	const fusionObjectValues = parsedFusionFile.getNodesByType(FusionObjectValue)
	if (fusionObjectValues !== undefined) {
		for (const diagnostic of getDiagnosticsFromFusionObjectValues(fusionObjectValues, severity, parsedFusionFile)) {
			diagnostics.push(diagnostic)
		}
	}

	return diagnostics
}