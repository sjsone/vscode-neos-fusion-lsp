import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { StatementList } from 'ts-fusion-parser/out/fusion/nodes/StatementList'
import { ValueUnset } from 'ts-fusion-parser/out/fusion/nodes/ValueUnset'
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import { getObjectIdentifier } from '../common/util'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { CommonDiagnosticHelper } from './CommonDiagnosticHelper'
import { ValueCopy } from 'ts-fusion-parser/out/fusion/nodes/ValueCopy'


export function diagnoseDuplicateStatements(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const positionedStatementLists = parsedFusionFile.getNodesByType(StatementList)
	if (!positionedStatementLists) return diagnostics

	for (const positionedStatementList of positionedStatementLists) {
		const statementList = positionedStatementList.getNode()

		const statementIdentifiers: string[] = []

		for (const statement of statementList.statements) {
			if (!(statement instanceof ObjectStatement)) continue
			if (statement.operation instanceof ValueUnset) continue
			if (statement.operation instanceof ValueCopy) continue

			const objectIdentifier = getObjectIdentifier(statement)
			if (!statementIdentifiers.includes(objectIdentifier)) {
				statementIdentifiers.push(objectIdentifier)
				continue
			}

			const firstPathSegment = statement.path.segments[0]
			const lastPathSegment = statement.path.segments[statement.path.segments.length - 1]
			diagnostics.push({
				severity: DiagnosticSeverity.Error,
				range: {
					start: firstPathSegment.linePositionedNode.getBegin(),
					end: lastPathSegment.linePositionedNode.getEnd()
				},
				message: `Duplicate Statement`,
				source: CommonDiagnosticHelper.Source
			})
		}
	}

	return diagnostics
}