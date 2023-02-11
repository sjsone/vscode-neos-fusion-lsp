import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { Comment } from 'ts-fusion-parser/out/common/Comment'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { LiteralNullNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralNullNode'
import { LiteralNumberNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralNumberNode'
import { LiteralStringNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { StringValue } from 'ts-fusion-parser/out/fusion/nodes/StringValue'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { LinePosition, LinePositionedNode } from '../common/LinePositionedNode'
import { NodeService } from '../common/NodeService'
import { findParent, getObjectIdentifier, parseSemanticComment } from '../common/util'
import { PhpClassMethodNode } from '../fusion/PhpClassMethodNode'
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

function sortSemanticTokenConstructsByLineAndCharacter(constructs: SemanticTokenConstruct[]) {
	return constructs.sort((a, b) => {
		if (a.position.line === b.position.line) return a.position.character - b.position.character
		return a.position.line - b.position.line
	})
}

//TODO: Implement cache 
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

		semanticTokenConstructs.push(...this.generateActionUriTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateLiteralStringTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateLiteralNumberTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateLiteralNullTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateObjectPathTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generatePhpClassMethodTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateTagAttributeTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateSemanticCommentTokens(languageFeatureContext))

		return {
			data: this.generateTokenArray(semanticTokenConstructs)
		}
	}

	protected* getSemanticTokenConstructsFromObjectStatement(objectStatement: ObjectStatement) {
		for (const statement of objectStatement.block.statementList.statements) {
			if (!(statement instanceof ObjectStatement)) continue
			if (!(statement.operation instanceof ValueAssignment)) continue
			if (!(statement.operation.pathValue instanceof StringValue)) continue

			const identifier = getObjectIdentifier(statement)

			if(identifier !== "controller" && identifier !== "action" && identifier !== "package") continue

			const begin = statement.operation.pathValue.linePositionedNode.getBegin()
			yield {
				position: {
					character: begin.character + 1, // offset for quote
					line: begin.line
				},
				length: statement.operation.pathValue.value.replace(/\\/g, "\\\\").length,
				...this.getTypesAndModifier(identifier)
			}
		}
	}

	protected generateActionUriTokens(languageFeatureContext: LanguageFeatureContext) {
		const fusionObjectValues = languageFeatureContext.parsedFile.getNodesByType(FusionObjectValue)
		if (!fusionObjectValues) return []

		const semanticTokenConstructs: SemanticTokenConstruct[] = []

		for (const fusionObjectValue of fusionObjectValues) {
			const node = fusionObjectValue.getNode()
			if (!["Neos.Fusion:ActionUri", "Neos.Fusion:UriBuilder"].includes(node.value)) continue

			const objectStatement = findParent(node, ObjectStatement)
			if (!(objectStatement.operation instanceof ValueAssignment)) continue
			if (objectStatement.block === undefined) continue

			for(const semanticTokenConstruct of this.getSemanticTokenConstructsFromObjectStatement(objectStatement)) {
				semanticTokenConstructs.push(semanticTokenConstruct)
			}
		}

		return semanticTokenConstructs
	}

	protected generateLiteralStringTokens(languageFeatureContext: LanguageFeatureContext) {
		return this.generateForType(LiteralStringNode, languageFeatureContext, node => ({
			position: node.getBegin(),
			length: node.getNode()["value"].length + 2, // offset for quotes
			type: 'string',
			modifier: 'declaration'
		}))
	}

	protected generateLiteralNumberTokens(languageFeatureContext: LanguageFeatureContext) {
		return this.generateForType(LiteralNumberNode, languageFeatureContext, node => ({
			position: node.getBegin(),
			length: node.getNode()["value"].length,
			type: 'number',
			modifier: 'declaration'
		}))
	}

	protected generateLiteralNullTokens(languageFeatureContext: LanguageFeatureContext) {
		return this.generateForType(LiteralNullNode, languageFeatureContext, node => ({
			position: node.getBegin(),
			length: node.getNode()["value"].length,
			type: 'variable',
			modifier: 'declaration'
		}))
	}

	protected generateObjectPathTokens(languageFeatureContext: LanguageFeatureContext) {
		return this.generateForType(ObjectPathNode, languageFeatureContext, node => ({
			position: node.getBegin(),
			length: node.getNode()["value"].length,
			type: 'property',
			modifier: 'declaration'
		}))
	}

	protected generatePhpClassMethodTokens(languageFeatureContext: LanguageFeatureContext) {
		return this.generateForType(PhpClassMethodNode, languageFeatureContext, node => ({
			position: node.getBegin(),
			length: node.getNode().identifier.length,
			type: 'method',
			modifier: 'declaration'
		}))
	}

	protected generateTagAttributeTokens(languageFeatureContext: LanguageFeatureContext) {
		const tagAttributeNodes = languageFeatureContext.parsedFile.getNodesByType(TagAttributeNode)
		if (!tagAttributeNodes) return []

		const semanticTokenConstructs: SemanticTokenConstruct[] = []

		for (const tagAttributeNode of tagAttributeNodes) {
			const tagNode = findParent(tagAttributeNode.getNode(), TagNode)
			if (tagNode === undefined) continue

			for (const statement of NodeService.getInheritedPropertiesByPrototypeName(tagNode["name"], languageFeatureContext.workspace, true)) {
				const identifier = getObjectIdentifier(statement.statement)

				if (tagAttributeNode.getNode().name === identifier) {
					semanticTokenConstructs.push({
						position: tagAttributeNode.getBegin(),
						length: identifier.length,
						type: 'property',
						modifier: 'definition'
					})
					break
				}
			}
		}

		return semanticTokenConstructs
	}

	protected generateSemanticCommentTokens(languageFeatureContext: LanguageFeatureContext) {
		const commentNodes = languageFeatureContext.parsedFile.getNodesByType(Comment)
		if (!commentNodes) return []

		const semanticTokenConstructs: SemanticTokenConstruct[] = []

		for (const commentNode of commentNodes) {
			const node = commentNode.getNode()
			const commentValue = node.value

			const parsedSemanticComment = parseSemanticComment(node.value.trim())
			if (!parsedSemanticComment) continue

			const begin = commentNode.getBegin()
			semanticTokenConstructs.push({
				position: {
					line: begin.line,
					character: begin.character + node.prefix.length
				},
				length: commentValue.length,
				type: 'operator',
				modifier: 'modification'
			})
		}

		return semanticTokenConstructs
	}

	protected generateForType<T extends AbstractNode>(type: new (...args: any) => T, languageFeatureContext: LanguageFeatureContext, createConstructCallback: (node: LinePositionedNode<T>) => SemanticTokenConstruct) {
		const nodes = languageFeatureContext.parsedFile.getNodesByType(type)
		return nodes ? nodes.map(createConstructCallback) : []
	}

	protected getTypesAndModifier(identifier: string): { type: TokenTypes, modifier: TokenModifiers } {
		if (identifier === "action") return { type: 'method', modifier: 'declaration' }
		if (identifier === "controller") return { type: 'class', modifier: 'declaration' }
		if (identifier === "package") return { type: 'namespace', modifier: 'declaration' }
		return { type: 'variable', modifier: 'declaration' }
	}

	protected generateTokenArray(constructs: SemanticTokenConstruct[]) {
		const sortedConstructs = sortSemanticTokenConstructsByLineAndCharacter(constructs)

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