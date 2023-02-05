import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode';
import { LiteralArrayNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralArrayNode';
import { BoolValue } from 'ts-fusion-parser/out/fusion/nodes/BoolValue';
import { CharValue } from 'ts-fusion-parser/out/fusion/nodes/CharValue';
import { DslExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/DslExpressionValue';
import { EelExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/EelExpressionValue';
import { FloatValue } from 'ts-fusion-parser/out/fusion/nodes/FloatValue';
import { FusionFile } from 'ts-fusion-parser/out/fusion/nodes/FusionFile';
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue';
import { IntValue } from 'ts-fusion-parser/out/fusion/nodes/IntValue';
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/nodes/MetaPathSegment';
import { NullValue } from 'ts-fusion-parser/out/fusion/nodes/NullValue';
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement';
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment';
import { StatementList } from 'ts-fusion-parser/out/fusion/nodes/StatementList';
import { StringValue } from 'ts-fusion-parser/out/fusion/nodes/StringValue';
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment';
import { ValueUnset } from 'ts-fusion-parser/out/fusion/nodes/ValueUnset';
import { DocumentSymbol, SymbolKind } from 'vscode-languageserver';
import { ParsedFusionFile } from '../fusion/ParsedFusionFile';
import { LinePositionedNode } from '../common/LinePositionedNode';
import { findParent, getObjectIdentifier } from '../common/util';
import { AbstractCapability } from './AbstractCapability';
import { CapabilityContext, ParsedFileCapabilityContext } from './CapabilityContext';

// TODO: Implement cache
export class DocumentSymbolCapability extends AbstractCapability {
	protected noPositionedNode: boolean = true

	protected alreadyParsedPrototypes: AbstractNode[] = []

	protected run(context: CapabilityContext<AbstractNode>) {
		const { parsedFile } = <ParsedFileCapabilityContext<AbstractNode>>context
		const symbols = this.getSymbolsFromParsedFile(parsedFile)

		this.alreadyParsedPrototypes = []
		
		return symbols
	}

	protected getSymbolsFromParsedFile(parsedFile: ParsedFusionFile) {
		const symbols: DocumentSymbol[] = []
		for (const prototypeDefinition of parsedFile.prototypeCreations) {
			const symbol = this.createDocumentSymbolFromPositionedNode(prototypeDefinition)
			if (symbol) symbols.push(symbol)
		}

		for (const prototypeOverwrite of parsedFile.prototypeOverwrites) {
			const node = prototypeOverwrite.getNode()

			const parentStatementList = findParent(node, StatementList)
			if (!parentStatementList) continue
			if (!(parentStatementList["parent"] instanceof FusionFile)) continue

			const symbol = this.createDocumentSymbolFromPositionedNode(prototypeOverwrite, undefined, SymbolKind.Interface)
			if (symbol) symbols.push(symbol)
		}

		const objectStatements = parsedFile.getNodesByType(ObjectStatement)
		if (objectStatements !== undefined) {
			for (const objectStatement of objectStatements) {
				const node = objectStatement.getNode()
				const parentStatementList = findParent(node, StatementList)

				if (!parentStatementList) continue
				if (!(parentStatementList["parent"] instanceof FusionFile)) continue
				if (node["block"] !== undefined) continue
				if (!(node.path.segments[0] instanceof PrototypePathSegment)) continue

				const symbol = this.createDocumentSymbolFromPositionedNode(objectStatement)
				if (symbol) symbols.push(symbol)
			}
		}

		return symbols
	}

	protected createDocumentSymbolFromPositionedNode(positionedNode: LinePositionedNode<AbstractNode>, detail: string = '', kind: SymbolKind = SymbolKind.Class) {
		const node = positionedNode.getNode()

		if (node instanceof PrototypePathSegment) {
			if (this.alreadyParsedPrototypes.includes(node)) return null
			this.alreadyParsedPrototypes.push(node)

			const range = positionedNode.getPositionAsRange()
			const symbols: DocumentSymbol[] = []
			const objectStatement = findParent(node, ObjectStatement)
			if (objectStatement && objectStatement.block) {
				for (const statement of objectStatement.block.statementList.statements) {
					const symbol = this.createDocumentSymbolFromPositionedNode(statement.linePositionedNode, undefined, SymbolKind.Interface)
					if (symbol) symbols.push(symbol)
				}
			}

			return DocumentSymbol.create(node.identifier, detail, kind, range, range, symbols)
		}

		if (node instanceof ObjectStatement) {
			const firstSegment = node.path.segments[0]
			const range = firstSegment.linePositionedNode.getPositionAsRange()

			if (firstSegment instanceof PrototypePathSegment) {
				return this.createDocumentSymbolFromPositionedNode(firstSegment.linePositionedNode, undefined, SymbolKind.Interface)
			}

			if (node.operation && node.operation instanceof ValueUnset) return null

			const symbols: DocumentSymbol[] = []
			if (node.block) {
				for (const statement of node.block.statementList.statements) {
					const symbol = this.createDocumentSymbolFromPositionedNode(statement.linePositionedNode, undefined, SymbolKind.Interface)
					if (symbol) symbols.push(symbol)
				}
			}

			const { detail, kind } = this.getKindAndDetailForObjectStatement(node)
			return DocumentSymbol.create(getObjectIdentifier(node), detail, kind, range, range, symbols)
		}

		this.logDebug(`Could not create symbol for: ${node.constructor.name}`)

		return null
	}

	protected getKindAndDetailForObjectStatement(node: ObjectStatement) {
		if (node.path.segments[0] instanceof MetaPathSegment) return { detail: '', kind: SymbolKind.Event }

		if (node.operation && node.operation instanceof ValueAssignment) {
			const value = node.operation.pathValue

			if (value instanceof EelExpressionValue) {
				if (value.nodes instanceof LiteralArrayNode) return { detail: '${Array}', kind: SymbolKind.Array }
				return { detail: '${...}', kind: SymbolKind.Variable }
			}
			if (value instanceof FusionObjectValue) return { detail: value.value, kind: SymbolKind.Object }
			if (value instanceof DslExpressionValue) return { detail: 'afx`...`', kind: SymbolKind.Constructor }

			if (value instanceof StringValue) return { detail: `"${value.value}"`, kind: SymbolKind.String }
			if (value instanceof CharValue) return { detail: `"${value.value}"`, kind: SymbolKind.String }

			if (value instanceof FloatValue) return { detail: value.value.toString(), kind: SymbolKind.Number }
			if (value instanceof IntValue) return { detail: value.value.toString(), kind: SymbolKind.Number }

			if (value instanceof NullValue) return { detail: 'NULL', kind: SymbolKind.Null }
			if (value instanceof BoolValue) return { detail: value.value ? 'true' : 'false', kind: SymbolKind.Boolean }

		}

		return { detail: '', kind: SymbolKind.Property }
	}

}