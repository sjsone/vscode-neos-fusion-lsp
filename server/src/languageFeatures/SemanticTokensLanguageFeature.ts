import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue';
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ObjectStatement';
import { StringValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/StringValue';
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueAssignment';
import { SemanticTokens } from 'vscode-languageserver';
import { findParent, getObjectIdentifier } from '../common/util';
import { AbstractLanguageFeature } from './AbstractLanguageFeature';
import { LanguageFeatureContext } from './LanguageFeatureContext';

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
	]
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
	]

	protected run(languageFeatureContext: LanguageFeatureContext) {
		const semanticTokens: SemanticTokens = {
			data: []
		}

		const statementsPairs: { identifier: string, statement: ObjectStatement, pathValue: StringValue }[] = []

		for (const fusionObjectValue of languageFeatureContext.parsedFile.getNodesByType(FusionObjectValue)) {
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
					statementsPairs.push({
						identifier,
						statement,
						pathValue: statement.operation.pathValue
					})
				}
			}
		}


		let lastLine = 0
		let lastStartChar = 0

		for (const statementsPair of statementsPairs) {
			// { deltaLine: 2, deltaStartChar: 5, length: 3, tokenType: 0, tokenModifiers: 3 }
			const character = statementsPair.pathValue.linePositionedNode.getBegin().character + 1 // offset for quote
			const line = statementsPair.pathValue.linePositionedNode.getBegin().line

			const deltaLine = line - lastLine
			const deltaStartChar = deltaLine === 0 ? character - lastStartChar : character
			const length = statementsPair.pathValue.value.length

			const { type, modifier } = this.getTypesAndModifier(statementsPair.identifier)

			semanticTokens.data.push(deltaLine, deltaStartChar, length, type, modifier)

			lastLine = line
			lastStartChar = character
		}

		console.log(semanticTokens)
		return semanticTokens
	}

	protected getTypesAndModifier(identifier: string): { type: number, modifier: number } {
		if (identifier === "action") {
			return { type: 13, modifier: 0 }
		}
		if (identifier === "controller") {
			return { type: 2, modifier: 0 }
		}
	}

}