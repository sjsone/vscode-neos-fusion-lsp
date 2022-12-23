import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode';
import { LiteralArrayNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralArrayNode';
import { BoolValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/BoolValue';
import { CharValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/CharValue';
import { DslExpressionValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/DslExpressionValue';
import { EelExpressionValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/EelExpressionValue';
import { FloatValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FloatValue';
import { FusionFile } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionFile';
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue';
import { IntValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/IntValue';
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/MetaPathSegment';
import { NullValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/NullValue';
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ObjectStatement';
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment';
import { StatementList } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/StatementList';
import { StringValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/StringValue';
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueAssignment';
import { ValueUnset } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ValueUnset';
import { DocumentSymbol, SymbolKind } from 'vscode-languageserver';
import { LinePositionedNode } from '../LinePositionedNode';
import { findParent, getObjectIdentifier } from '../util';
import { AbstractCapability } from './AbstractCapability';
import { CapabilityContext } from './CapabilityContext';


export class DocumentSymbolCapability extends AbstractCapability {
	protected noPositionedNode: boolean = true

	protected run(context: CapabilityContext<AbstractNode>) {
		const { workspace, parsedFile } = context

		const symbols: DocumentSymbol[] = []
		for (const prototypeDefinition of parsedFile.prototypeCreations) {
			symbols.push(this.createDocumentSymbolFromPositionedNode(prototypeDefinition))
		}

		for (const prototypeOverwrite of parsedFile.prototypeOverwrites) {
			const parentStatementList = findParent(prototypeOverwrite.getNode(), StatementList)
			if (!parentStatementList) continue
			if (!(parentStatementList["parent"] instanceof FusionFile)) continue
			symbols.push(this.createDocumentSymbolFromPositionedNode(prototypeOverwrite, undefined, SymbolKind.Interface))
		}

		const objectStatements = parsedFile.getNodesByType(ObjectStatement)
		if (objectStatements !== undefined) {
			for (const objectStatement of objectStatements) {
				const node = objectStatement.getNode()
				const parentStatementList = findParent(node, StatementList)
				if (!parentStatementList) continue
				if (!(parentStatementList["parent"] instanceof FusionFile)) continue
				if (node["block"] !== undefined) continue
				console.log("objectStatement", objectStatement.getNode().path)
				if (!(node.path.segments[0] instanceof PrototypePathSegment)) continue
				symbols.push(this.createDocumentSymbolFromPositionedNode(objectStatement))
			}
		}

		return symbols
	}

	protected createDocumentSymbolFromPositionedNode(positionedNode: LinePositionedNode<AbstractNode>, detail: string = '', kind: SymbolKind = SymbolKind.Class) {
		const node = positionedNode.getNode()

		if (node instanceof PrototypePathSegment) {
			const range = positionedNode.getPositionAsRange()
			const symbols: DocumentSymbol[] = []
			const objectStatement = findParent(node, ObjectStatement)
			if (objectStatement && objectStatement.block) {
				for (const statement of objectStatement.block.statementList.statements) {
					const symbol = this.createDocumentSymbolFromPositionedNode(LinePositionedNode.Get(statement), undefined, SymbolKind.Interface)
					if (symbol) symbols.push(symbol)
				}
			}

			return DocumentSymbol.create(node.identifier, detail, kind, range, range, symbols)
		}

		if (node instanceof ObjectStatement) {
			const firstSegment = node.path.segments[0]
			const range = LinePositionedNode.Get(firstSegment).getPositionAsRange()

			if (firstSegment instanceof PrototypePathSegment) {
				return this.createDocumentSymbolFromPositionedNode(LinePositionedNode.Get(firstSegment), undefined, SymbolKind.Interface)
			}

			if (node.operation && node.operation instanceof ValueUnset) return null

			const symbols: DocumentSymbol[] = []
			if (node.block) {
				for (const statement of node.block.statementList.statements) {
					const symbol = this.createDocumentSymbolFromPositionedNode(LinePositionedNode.Get(statement), undefined, SymbolKind.Interface)
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

			if (value instanceof StringValue) return { detail: value.value, kind: SymbolKind.String }
			if (value instanceof CharValue) return { detail: value.value, kind: SymbolKind.String }

			if (value instanceof FloatValue) return { detail: value.value.toString(), kind: SymbolKind.Number }
			if (value instanceof IntValue) return { detail: value.value.toString(), kind: SymbolKind.Number }

			if (value instanceof NullValue) return { detail: 'NULL', kind: SymbolKind.Null }
			if (value instanceof BoolValue) return { detail: value.value ? 'true' : 'false', kind: SymbolKind.Boolean }

		}

		return { detail: '', kind: SymbolKind.Property }
	}

}