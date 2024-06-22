import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { Comment } from 'ts-fusion-parser/out/common/Comment'
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { LiteralNullNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralNullNode'
import { LiteralNumberNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralNumberNode'
import { LiteralStringNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { EelExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/EelExpressionValue'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { StatementList } from 'ts-fusion-parser/out/fusion/nodes/StatementList'
import { StringValue } from 'ts-fusion-parser/out/fusion/nodes/StringValue'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { ActionUriPartTypes } from '../common/ActionUriService'
import { LinePosition, LinePositionedNode } from '../common/LinePositionedNode'
import { findParent, getObjectIdentifier } from '../common/util'
import { ActionUriDefinitionNode } from '../fusion/node/ActionUriDefinitionNode'
import { NeosFusionFormDefinitionNode } from '../fusion/node/NeosFusionFormDefinitionNode'
import { PhpClassMethodNode } from '../fusion/node/PhpClassMethodNode'
import { TranslationShortHandNode } from '../fusion/node/TranslationShortHandNode'
import { AbstractLanguageFeature } from './AbstractLanguageFeature'
import { LanguageFeatureContext } from './LanguageFeatureContext'
import { FqcnNode } from '../fusion/node/FqcnNode'
import { NodeService } from '../common/NodeService'
import { SemanticTokensParams } from 'vscode-languageserver'
import { RoutingActionNode } from '../fusion/node/RoutingActionNode'
import { RoutingControllerNode } from '../fusion/node/RoutingControllerNode'
import { SemanticCommentService } from '../common/SemanticCommentService'

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

//TODO: Consolidate with DefinitionCapability::getControllerActionDefinition
export class SemanticTokensLanguageFeature extends AbstractLanguageFeature<SemanticTokensParams> {

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
		semanticTokenConstructs.push(...this.generateRoutingTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateLiteralStringTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateLiteralNumberTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateLiteralNullTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateObjectPathTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateFqcnTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generatePhpClassMethodTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateFlowQueryTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateTagTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateTagAttributeTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateSemanticCommentTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateComponentRendererTokens(languageFeatureContext))
		semanticTokenConstructs.push(...this.generateTranslationShortHandTokens(languageFeatureContext))

		return {
			data: this.generateTokenArray(semanticTokenConstructs)
		}
	}

	protected generateActionUriTokens(languageFeatureContext: LanguageFeatureContext) {
		const semanticTokenConstructs: SemanticTokenConstruct[] = []

		const actionUriDefinitionNodes = languageFeatureContext.parsedFile.getNodesByType(ActionUriDefinitionNode)
		if (actionUriDefinitionNodes) for (const actionUriDefinitionNode of actionUriDefinitionNodes) {
			const node = actionUriDefinitionNode.getNode()

			for (const semanticTokenConstruct of this.getSemanticTokenConstructsFromObjectStatement(node.statement)) {
				semanticTokenConstructs.push(semanticTokenConstruct)
			}
		}

		const neosFusionFormDefinitionNodes = languageFeatureContext.parsedFile.getNodesByType(NeosFusionFormDefinitionNode)
		if (neosFusionFormDefinitionNodes) for (const neosFusionFormDefinitionNode of neosFusionFormDefinitionNodes) {
			const node = neosFusionFormDefinitionNode.getNode()

			for (const definition of [node.action, node.controller].filter(Boolean)) {
				if (!definition) continue

				const begin = definition.tagAttribute.linePositionedNode.getBegin()
				semanticTokenConstructs.push({
					position: {
						character: begin.character + definition.tagAttribute.name.length + 2, // offset for quote and `=`
						line: begin.line
					},
					length: definition.tagAttribute.value.replace(/\\/g, "\\\\").length - 2,
					...this.getTypesAndModifier(definition.tagAttribute.name.replace('form.target.', ''))
				})
			}
		}

		return semanticTokenConstructs
	}

	protected * generateRoutingTokens(languageFeatureContext: LanguageFeatureContext) {
		yield* this.generateForType(RoutingActionNode, languageFeatureContext, node => ({
			position: node.getBegin(),
			length: node.getNode().name.length,
			type: 'method',
			modifier: 'declaration'
		}))

		yield* this.generateForType(RoutingControllerNode, languageFeatureContext, node => ({
			position: node.getBegin(),
			length: node.getNode().name.length,
			type: 'class',
			modifier: 'declaration'
		}))
	}

	protected * getSemanticTokenConstructsFromObjectStatement(objectStatement: ObjectStatement) {
		for (const statement of objectStatement.block!.statementList.statements) {
			if (!(statement instanceof ObjectStatement)) continue
			if (!(statement.operation instanceof ValueAssignment)) continue
			if (!(statement.operation.pathValue instanceof StringValue)) continue

			const identifier = getObjectIdentifier(statement)
			if (identifier !== ActionUriPartTypes.Action && identifier !== ActionUriPartTypes.Controller && identifier !== ActionUriPartTypes.Package) continue

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

	protected generateLiteralStringTokens(languageFeatureContext: LanguageFeatureContext) {
		return this.generateForType(LiteralStringNode, languageFeatureContext, node => {
			if (findParent(node.getNode(), EelExpressionValue)) return undefined
			if (node.getNode().translationShortHandNode !== undefined) return undefined
			return {
				position: node.getBegin(),
				length: node.getNode().value.length + 2, // offset for quotes
				type: 'string',
				modifier: 'declaration'
			}
		})
	}

	protected generateLiteralNumberTokens(languageFeatureContext: LanguageFeatureContext) {
		return this.generateForType(LiteralNumberNode, languageFeatureContext, node => ({
			position: node.getBegin(),
			length: node.getNode().value.length,
			type: 'number',
			modifier: 'declaration'
		}))
	}

	protected generateLiteralNullTokens(languageFeatureContext: LanguageFeatureContext) {
		return this.generateForType(LiteralNullNode, languageFeatureContext, node => ({
			position: node.getBegin(),
			length: node.getNode().value.length,
			type: 'variable',
			modifier: 'declaration'
		}))
	}

	protected generateObjectPathTokens(languageFeatureContext: LanguageFeatureContext) {
		return this.generateForType(ObjectPathNode, languageFeatureContext, node => ({
			position: node.getBegin(),
			length: node.getNode().value.length,
			type: 'property',
			modifier: 'declaration'
		}))
	}

	protected generateFqcnTokens(languageFeatureContext: LanguageFeatureContext) {
		return this.generateForType(FqcnNode, languageFeatureContext, node => ({
			position: node.getBegin(),
			length: node.getNode().realLength,
			type: 'class',
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

	protected generateFlowQueryTokens(languageFeatureContext: LanguageFeatureContext) {
		const prototypePathSegments = languageFeatureContext.parsedFile.getNodesByType(PrototypePathSegment)
		if (!prototypePathSegments) return []

		const semanticTokenConstructs: SemanticTokenConstruct[] = []
		for (const prototypePathSegment of prototypePathSegments) {
			const node = prototypePathSegment.getNode()
			if (!(node.parent instanceof LiteralStringNode)) continue
			semanticTokenConstructs.push({
				position: prototypePathSegment.getBegin(),
				length: node.identifier.length,
				type: 'class',
				modifier: 'definition'
			})
		}

		return semanticTokenConstructs
	}

	protected generateTagTokens(languageFeatureContext: LanguageFeatureContext) {
		const prototypePathSegments = languageFeatureContext.parsedFile.getNodesByType(PrototypePathSegment)
		if (!prototypePathSegments) return []

		const semanticTokenConstructs: SemanticTokenConstruct[] = []
		for (const prototypePathSegment of prototypePathSegments) {
			const node = prototypePathSegment.getNode()
			if (!(node.parent instanceof TagNode)) continue

			semanticTokenConstructs.push({
				position: prototypePathSegment.getBegin(),
				length: node.identifier.length,
				type: 'class',
				modifier: 'definition'
			})
		}

		return semanticTokenConstructs
	}

	protected generateTagAttributeTokens(languageFeatureContext: LanguageFeatureContext) {
		const workspace = languageFeatureContext.workspace
		if (!workspace.mergedArrayTree.__prototypes) return []

		const tagAttributeNodes = languageFeatureContext.parsedFile.getNodesByType(TagAttributeNode)
		if (!tagAttributeNodes) return []

		const semanticTokenConstructs: SemanticTokenConstruct[] = []

		for (const tagAttributeNode of tagAttributeNodes) {
			const tagNode = findParent(tagAttributeNode.getNode(), TagNode)
			if (tagNode === undefined) continue
			if (!tagNode.name.includes(":")) continue
			if (!(tagNode.name in workspace.mergedArrayTree.__prototypes)) continue

			for (const propertyName in workspace.mergedArrayTree.__prototypes[tagNode.name]) {
				if (tagAttributeNode.getNode().name !== propertyName) continue
				semanticTokenConstructs.push({
					position: tagAttributeNode.getBegin(),
					length: propertyName.length,
					type: 'property',
					modifier: 'definition'
				})
				break
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

			const parsedSemanticComment = SemanticCommentService.parseSemanticComment(node.value.trim())
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

		// FIXME: check why comment in statement list has wrong position (line)
		// console.log("semanticTokenConstructs", semanticTokenConstructs)

		return semanticTokenConstructs
	}

	protected createRendererTokenConstructFromStatementList(statementList: StatementList) {
		const semanticTokenConstructs: SemanticTokenConstruct[] = []

		for (const statement of statementList.statements) {
			if (!(statement instanceof ObjectStatement)) continue
			const firstSegment = statement.path.segments[0]
			if (!(firstSegment instanceof PathSegment)) continue
			if (firstSegment.identifier !== 'renderer') continue

			semanticTokenConstructs.push({
				position: firstSegment.linePositionedNode.getBegin(),
				length: 'renderer'.length,
				type: 'property',
				modifier: 'static'
			})
		}

		return semanticTokenConstructs
	}

	protected generateComponentRendererTokens(languageFeatureContext: LanguageFeatureContext) {
		const semanticTokenConstructs: SemanticTokenConstruct[] = []

		for (const prototypeDefinition of [...languageFeatureContext.parsedFile.prototypeCreations, ...languageFeatureContext.parsedFile.prototypeOverwrites]) {
			const node = prototypeDefinition.getNode()
			if (!NodeService.isPrototypeOneOf(node.identifier, 'Neos.Fusion:Component', languageFeatureContext.workspace)) continue

			const block = findParent(node, ObjectStatement)?.block
			if (!block) continue

			semanticTokenConstructs.push(...this.createRendererTokenConstructFromStatementList(block.statementList))
		}

		const fusionObjectValues = languageFeatureContext.parsedFile.getNodesByType(FusionObjectValue)
		if (fusionObjectValues) for (const fusionObjectValue of fusionObjectValues) {
			const node = fusionObjectValue.getNode()
			if (node.value !== 'Neos.Fusion:Component') continue

			const block = findParent(node, ObjectStatement)?.block
			if (!block) continue

			semanticTokenConstructs.push(...this.createRendererTokenConstructFromStatementList(block.statementList))
		}

		return semanticTokenConstructs
	}

	protected generateTranslationShortHandTokens(languageFeatureContext: LanguageFeatureContext) {
		return this.generateForType(TranslationShortHandNode, languageFeatureContext, node => ({
			position: node.getBegin(),
			length: node.getNode().getValue().length + 2, // quotes
			type: 'variable',
			modifier: 'declaration'
		}))
	}

	protected * generateForType<T extends AbstractNode>(type: new (...args: any) => T, languageFeatureContext: LanguageFeatureContext, createConstructCallback: (node: LinePositionedNode<T>) => undefined | SemanticTokenConstruct) {
		const nodes = languageFeatureContext.parsedFile.getNodesByType(type)
		if (!nodes) return

		for (const node of nodes) {
			const value = createConstructCallback(node)
			if (value) yield value
		}
	}

	protected getTypesAndModifier(identifier: string): { type: TokenTypes, modifier: TokenModifiers } {
		if (identifier === ActionUriPartTypes.Action) return { type: 'method', modifier: 'declaration' }
		if (identifier === ActionUriPartTypes.Controller) return { type: 'class', modifier: 'declaration' }
		if (identifier === ActionUriPartTypes.Package) return { type: 'namespace', modifier: 'declaration' }
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