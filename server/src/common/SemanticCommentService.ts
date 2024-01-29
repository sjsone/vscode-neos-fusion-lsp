import { Logger } from './Logging'

export enum SemanticCommentType {
	Ignore = "ignore",
	IgnoreBlock = "ignore-block",
	NoAutoincludeNeeded = "no-autoinclude-needed"
}

export interface ParsedSemanticComment {
	type: SemanticCommentType
	arguments: string[]
}

class SemanticCommentService extends Logger {

	parseSemanticComment(comment: string): undefined | ParsedSemanticComment {
		const semanticCommentRegex = /^ *@fusion-([a-zA-Z0-9_-]+) *(?:\[(.*)\])?$/

		const matches = semanticCommentRegex.exec(comment)
		if (!matches) return undefined

		const rawArguments = matches[2]
		return {
			type: <SemanticCommentType>matches[1],
			arguments: rawArguments ? rawArguments.split(',').filter(Boolean).map(arg => arg.trim()) : []
		}
	}
}

const semanticCommentService = new SemanticCommentService
export { semanticCommentService as SemanticCommentService }