import { Diagnostic, Range, DiagnosticSeverity, integer, DiagnosticRelatedInformation } from 'vscode-languageserver'

export interface IgnorableDiagnostic extends Diagnostic {
	data: {
		quickAction: "ignorable"
	}
}

export namespace IgnorableDiagnostic {
	/**
	 * Creates a new IgnorableDiagnostic literal.
	 */
	export function create(range: Range, message: string, severity?: DiagnosticSeverity, code?: integer | string, source?: string, relatedInformation?: DiagnosticRelatedInformation[]) {
		const diagnostic = <IgnorableDiagnostic>Diagnostic.create(range, message, severity, code, source, relatedInformation)
		diagnostic.data = {
			quickAction: "ignorable"
		}
		return diagnostic
	}

	/**
	 * Checks whether the given literal conforms to the {@link IgnorableDiagnostic} interface.
	 */
	export function is(value: any): value is IgnorableDiagnostic {
		return Diagnostic.is(value) && value.data?.quickAction === "ignorable"
	}
}
