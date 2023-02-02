import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { StringValue } from 'ts-fusion-parser/out/fusion/nodes/StringValue'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { LinePosition } from '../common/LinePositionedNode'
import { findParent, getObjectIdentifier } from '../common/util'
import { AbstractLanguageFeature } from './AbstractLanguageFeature'
import { LanguageFeatureContext } from './LanguageFeatureContext'

export interface SemanticTokenConstruct {
	position: LinePosition
	length: number,
	type: string,
	modifier: string
}

export type TokenTypes = typeof SemanticTokensLanguageFeature.TokenTypes[number]
export type TokenModifiers = typeof SemanticTokensLanguageFeature.TokenModifiers[number]

//TODO: Consolidate with DefinitionCapability::getControllerActionDefinition
export class SemanticTokensLanguageFeature extends AbstractLanguageFeature {

	static TokenTypes = [
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
	] as const

	static TokenModifiers = [
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
	] as const

	protected run(languageFeatureContext: LanguageFeatureContext) {
		const semanticTokenConstructs: SemanticTokenConstruct[] = []
		const fusionObjectValues = languageFeatureContext.parsedFile.getNodesByType(FusionObjectValue)
		if (!fusionObjectValues) return null

		for (const fusionObjectValue of fusionObjectValues) {
			const node = fusionObjectValue.getNode()
			if (!["Neos.Fusion:ActionUri", "Neos.Fusion:UriBuilder"].includes(node.value)) continue

			const objectStatement = findParent(node, ObjectStatement)
			if (!(objectStatement.operation instanceof ValueAssignment)) continue

			for (const statement of objectStatement.block.statementList.statements) {
				if (!(statement instanceof ObjectStatement)) continue
				if (!(statement.operation instanceof ValueAssignment)) continue
				if (!(statement.operation.pathValue instanceof StringValue)) continue

				const identifier = getObjectIdentifier(statement)
				if (identifier === "controller" || identifier === "action") {
					const begin = statement.operation.pathValue.linePositionedNode.getBegin()
					const { type, modifier } = this.getTypesAndModifier(identifier)

					semanticTokenConstructs.push({
						position: {
							character: begin.character + 1, // offset for quote
							line: begin.line
						},
						length: statement.operation.pathValue.value.length,
						type,
						modifier
					})
				}
			}
		}

		return {
			data: this.generateTokenArray(semanticTokenConstructs)
		}
	}

	protected getTypesAndModifier(identifier: string): { type: TokenTypes, modifier: TokenModifiers } {
		if (identifier === "action") return { type: 'method', modifier: 'declaration' }
		if (identifier === "controller") return { type: 'class', modifier: 'declaration' }
		return { type: 'variable', modifier: 'declaration' }
	}

	protected generateTokenArray(constructs: SemanticTokenConstruct[]) {
		const sortedConstructs = constructs.sort((a, b) => {
			if (a.position.line === b.position.line) return a.position.character - b.position.character
			return a.position.line - b.position.line
		})

		const tokens: number[] = []

		let lastLine = 0
		let lastStartChar = 0

		for (const construct of sortedConstructs) {
			const character = construct.position.character
			const line = construct.position.line

			const deltaLine = line - lastLine
			const deltaStartChar = deltaLine === 0 ? character - lastStartChar : character

			const type = SemanticTokensLanguageFeature.TokenTypes.findIndex(type => type === construct.type)
			const modifier = SemanticTokensLanguageFeature.TokenModifiers.findIndex(modifier => modifier === construct.modifier)

			tokens.push(deltaLine, deltaStartChar, construct.length, type, modifier)

			lastLine = line
			lastStartChar = character
		}

		return tokens
	}

}