import { ParserError } from 'ts-fusion-parser/out/common/ParserError'
import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'


export const diagnoseParserError = (parsedFusionFile: ParsedFusionFile) => {
	const diagnostics: Diagnostic[] = []

	const ignoredErrors = parsedFusionFile.ignoredErrorsByParser

	if (ignoredErrors.length === 0) return diagnostics

	const firstError = <ParserError>ignoredErrors.reduce((firstError, error) => {
		if (!(error instanceof ParserError)) return firstError
		if (firstError === undefined) return error
		if ((firstError as ParserError).getPosition() > error.getPosition()) return error
		return firstError
	}, <ParserError><unknown>undefined)
	if (firstError === undefined) return diagnostics

	const position = firstError['linePosition']
	const range = Range.create(position, { line: position.line + 1, character: 0 })
	diagnostics.push(Diagnostic.create(range, "ParserError: " + firstError.message, DiagnosticSeverity.Error))

	return diagnostics
}