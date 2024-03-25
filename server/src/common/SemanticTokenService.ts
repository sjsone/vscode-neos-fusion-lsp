import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { LanguageFeatureContext } from '../languageFeatures/LanguageFeatureContext'
import { LinePosition, LinePositionedNode } from './LinePositionedNode'

export const TokenTypes = Object.freeze([
	'namespace', 'type',
	'class', 'enum',
	'interface', 'struct',
	'typeParameter', 'parameter',
	'variable', 'property',
	'enumMember', 'event',
	'function', 'method',
	'macro', 'keyword',
	'modifier', 'comment',
	'string', 'number',
	'regexp', 'operator',
	'decorator'
])



export const TokenModifiers = Object.freeze([
	'declaration',
	'definition',
	'readonly',
	'static',
	'deprecated',
	'abstract',
	'async',
	'modification',
	'documentation',
	'defaultLibrary'
])


export interface SemanticTokenConstruct {
	position: LinePosition
	length: number,
	type: string,
	modifier: string
}


class SemanticTokenService {

	protected sortSemanticTokenConstructsByLineAndCharacter(constructs: SemanticTokenConstruct[]) {
		return constructs.sort((a, b) => {
			if (a.position.line === b.position.line) return a.position.character - b.position.character
			return a.position.line - b.position.line
		})
	}

	generateTokenArray(constructs: SemanticTokenConstruct[]) {
		const sortedConstructs = this.sortSemanticTokenConstructsByLineAndCharacter(constructs)

		const tokens: number[] = []

		let lastLine = 0
		let lastStartChar = 0

		for (const construct of sortedConstructs) {
			const character = construct.position.character
			const line = construct.position.line

			const deltaLine = line - lastLine
			const deltaStartChar = deltaLine === 0 ? character - lastStartChar : character

			const type = TokenTypes.findIndex(type => type === construct.type)
			const modifier = TokenModifiers.findIndex(modifier => modifier === construct.modifier)

			tokens.push(deltaLine, deltaStartChar, construct.length, type, modifier)

			lastLine = line
			lastStartChar = character
		}

		return tokens
	}

	* generateForType<T extends AbstractNode>(type: new (...args: any) => T, languageFeatureContext: LanguageFeatureContext, createConstructCallback: (node: LinePositionedNode<T>) => undefined | SemanticTokenConstruct) {
		const nodes = languageFeatureContext.parsedFile.getNodesByType(type)
		if (!nodes) return

		for (const node of nodes) {
			const value = createConstructCallback(node)
			if (value) yield value
		}
	}
}

const SemanticTokenServiceInstance = new SemanticTokenService
export {
	SemanticTokenServiceInstance as SemanticTokenService
}
