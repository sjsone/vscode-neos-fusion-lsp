import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { Comment } from 'ts-fusion-parser/out/common/Comment'
import { InlineEelNode } from 'ts-fusion-parser/out/dsl/afx/nodes/InlineEelNode'
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode'
import { TextNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TextNode'
import { LiteralArrayNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralArrayNode'
import { BoolValue } from 'ts-fusion-parser/out/fusion/nodes/BoolValue'
import { CharValue } from 'ts-fusion-parser/out/fusion/nodes/CharValue'
import { DslExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/DslExpressionValue'
import { EelExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/EelExpressionValue'
import { FloatValue } from 'ts-fusion-parser/out/fusion/nodes/FloatValue'
import { FusionFile } from 'ts-fusion-parser/out/fusion/nodes/FusionFile'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { IntValue } from 'ts-fusion-parser/out/fusion/nodes/IntValue'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/nodes/MetaPathSegment'
import { NullValue } from 'ts-fusion-parser/out/fusion/nodes/NullValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { StatementList } from 'ts-fusion-parser/out/fusion/nodes/StatementList'
import { StringValue } from 'ts-fusion-parser/out/fusion/nodes/StringValue'
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment'
import { ValueUnset } from 'ts-fusion-parser/out/fusion/nodes/ValueUnset'
import { DocumentSymbol, SymbolKind } from 'vscode-languageserver'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { findParent, getObjectIdentifier } from '../common/util'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { AbstractCapability } from './AbstractCapability'
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext'

export class DocumentSymbolCapability extends AbstractCapability {
	protected noPositionedNode = true

	protected alreadyParsedPrototypes: AbstractNode[] = []

	protected run(context: CapabilityContext<AbstractNode>) {
		const { parsedFile } = <ParsedFileCapabilityContext<AbstractNode>>context
		const symbols = this.getSymbolsFromParsedFile(parsedFile)

		this.alreadyParsedPrototypes = []

		return symbols
	}

	protected getSymbolsFromParsedFile(parsedFile: ParsedFusionFile): DocumentSymbol[] {
		return [
			...this.getSymbolsFromPrototypeCreations(parsedFile),
			...this.getSymbolsFromPrototypeOverwrites(parsedFile),
			...this.getSymbolsFromObjectStatements(parsedFile)
		]
	}

	protected * getSymbolsFromPrototypeCreations(parsedFile: ParsedFusionFile) {
		for (const prototypeDefinition of parsedFile.prototypeCreations) {
			const symbol = this.createDocumentSymbolFromPositionedNode(prototypeDefinition)
			if (symbol) yield symbol
		}
	}

	protected * getSymbolsFromPrototypeOverwrites(parsedFile: ParsedFusionFile) {
		for (const prototypeOverwrite of parsedFile.prototypeOverwrites) {
			const node = prototypeOverwrite.getNode()

			const parentStatementList = findParent(node, StatementList)
			if (!parentStatementList) continue
			if (!(parentStatementList['parent'] instanceof FusionFile)) continue

			const symbol = this.createDocumentSymbolFromPositionedNode(prototypeOverwrite, undefined, SymbolKind.Interface)
			if (symbol) yield symbol
		}
	}

	protected * getSymbolsFromObjectStatements(parsedFile: ParsedFusionFile) {
		const objectStatements = parsedFile.getNodesByType(ObjectStatement)
		if (objectStatements === undefined) return

		for (const objectStatement of objectStatements) {
			const node = objectStatement.getNode()
			const parentStatementList = findParent(node, StatementList)

			if (!parentStatementList) continue
			if (!(parentStatementList['parent'] instanceof FusionFile)) continue
			if (node.block !== undefined) continue
			if (!(node.path.segments[0] instanceof PrototypePathSegment)) continue

			const symbol = this.createDocumentSymbolFromPositionedNode(objectStatement)
			if (symbol) yield symbol
		}
	}

	protected createDocumentSymbolFromPositionedPrototypePathSegment(node: PrototypePathSegment, detail: string, kind: SymbolKind) {
		if (this.alreadyParsedPrototypes.includes(node)) return null
		this.alreadyParsedPrototypes.push(node)

		const symbols: DocumentSymbol[] = []

		let range = node.linePositionedNode.getPositionAsRange()

		const objectStatement = findParent(node, ObjectStatement)
		if (objectStatement?.block) {
			range = objectStatement.block.linePositionedNode.getPositionAsRange()
			for (const statement of objectStatement.block.statementList.statements) {
				const symbol = this.createDocumentSymbolFromPositionedNode(statement.linePositionedNode, undefined, SymbolKind.Interface)
				if (symbol) symbols.push(symbol)
			}
		}

		return DocumentSymbol.create(node.identifier, detail, kind, range, range, symbols)
	}

	protected createDocumentSymbolFromPositionedObjectStatement(node: ObjectStatement): null | DocumentSymbol {
		const firstSegment = node.path.segments[0]

		if (firstSegment instanceof PrototypePathSegment) {
			return this.createDocumentSymbolFromPositionedNode(firstSegment.linePositionedNode, undefined, SymbolKind.Interface)
		}

		if (node.operation && node.operation instanceof ValueAssignment && node.operation.pathValue instanceof DslExpressionValue) {
			return this.createDocumentSymbolForPositionedDslNode(node)
		}

		if (node.operation && node.operation instanceof ValueUnset) return null

		let range = firstSegment.linePositionedNode.getPositionAsRange()
		const symbols: DocumentSymbol[] = []
		if (node.block) {
			range = node.block.linePositionedNode.getPositionAsRange()
			for (const statement of node.block.statementList.statements) {
				const symbol = this.createDocumentSymbolFromPositionedNode(statement.linePositionedNode, undefined, SymbolKind.Interface)
				if (symbol) symbols.push(symbol)
			}
		}

		const { detail, kind } = this.getKindAndDetailForObjectStatement(node)
		return DocumentSymbol.create(getObjectIdentifier(node), detail, kind, range, range, symbols)
	}

	protected createDocumentSymbolForPositionedDslNode(node: ObjectStatement) {
		if (!node.operation) return null
		if (!(node.operation instanceof ValueAssignment)) return null
		if (!(node.operation.pathValue instanceof DslExpressionValue)) return null

		const dslExpression = node.operation.pathValue
		const range = dslExpression.linePositionedNode.getPositionAsRange()

		const symbols: DocumentSymbol[] = []
		for (const htmlNode of dslExpression.htmlNodes) {
			const symbol = this.createDocumentSymbolFromAFXNode(htmlNode)
			if (symbol) symbols.push(symbol)
		}

		const { detail, kind } = this.getKindAndDetailForObjectStatement(node)
		return DocumentSymbol.create(getObjectIdentifier(node), detail, kind, range, range, symbols)
	}

	protected createDocumentSymbolFromAFXNode(node: TextNode | InlineEelNode | TagNode | Comment) {
		const range = node.linePositionedNode.getPositionAsRange()

		if (node instanceof TagNode) {
			const selfClosingNamePart = node.selfClosing ? ' /' : ''
			const name = `<${node.name}${selfClosingNamePart}>`

			const symbols: DocumentSymbol[] = []
			for (const htmlNode of node.content) {
				const symbol = this.createDocumentSymbolFromAFXNode(htmlNode)
				if (symbol) symbols.push(symbol)
			}

			return DocumentSymbol.create(name, undefined, SymbolKind.Field, range, range, symbols)
		}

		return null
	}

	protected createDocumentSymbolFromPositionedNode(positionedNode: LinePositionedNode<AbstractNode>, detail = '', kind: SymbolKind = SymbolKind.Class) {
		const node = positionedNode.getNode()

		if (node instanceof PrototypePathSegment) {
			return this.createDocumentSymbolFromPositionedPrototypePathSegment(node, detail, kind)
		}

		if (node instanceof ObjectStatement) {
			return this.createDocumentSymbolFromPositionedObjectStatement(node)
		}

		this.logDebug(`Could not create symbol for: ${node.constructor.name}`)

		return null
	}

	protected getKindAndDetailForObjectStatement(node: ObjectStatement) {
		if (node.path.segments[0] instanceof MetaPathSegment) return { detail: '', kind: SymbolKind.Event }
		if (!node.operation || !(node.operation instanceof ValueAssignment)) return { detail: '', kind: SymbolKind.Property }

		const value = node.operation.pathValue

		if (value instanceof EelExpressionValue) return this.getKindAndDetailForEelExpressionValue(value)
		if (value instanceof FusionObjectValue) return { detail: value.value, kind: SymbolKind.Object }
		if (value instanceof DslExpressionValue) return { detail: 'afx`...`', kind: SymbolKind.Constructor }

		if (value instanceof StringValue) return { detail: `"${value.value}"`, kind: SymbolKind.String }
		if (value instanceof CharValue) return { detail: `"${value.value}"`, kind: SymbolKind.String }

		if (value instanceof FloatValue) return { detail: value.value.toString(), kind: SymbolKind.Number }
		if (value instanceof IntValue) return { detail: value.value.toString(), kind: SymbolKind.Number }

		if (value instanceof NullValue) return { detail: 'NULL', kind: SymbolKind.Null }
		if (value instanceof BoolValue) return { detail: value.value ? 'true' : 'false', kind: SymbolKind.Boolean }

		return { detail: undefined, kind: SymbolKind.Variable }
	}

	protected getKindAndDetailForEelExpressionValue(value: EelExpressionValue) {
		if (value.nodes instanceof LiteralArrayNode) return { detail: '${Array}', kind: SymbolKind.Array }
		return { detail: '${...}', kind: SymbolKind.Variable }
	}

}