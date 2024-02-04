import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { CompletionItemKind, Command, CompletionItem, InsertTextMode, InsertTextFormat, Hover } from 'vscode-languageserver'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { ElementMethod } from './ElementInterface'

export class ElementHelper {
	static readonly SuggestCommand: Command = {
		title: 'Trigger Suggest',
		command: 'editor.action.triggerSuggest'
	}

	static readonly ParameterHintsCommand: Command = {
		title: "Trigger Parameter Hints",
		command: "editor.action.triggerParameterHints"
	}

	static createCompletionItem(label: string, linePositionedNode: LinePositionedNode<AbstractNode>, kind: CompletionItemKind, newText: string | undefined = undefined, command: Command | undefined = undefined): CompletionItem {
		return {
			label,
			kind,
			insertText: label,
			insertTextMode: InsertTextMode.adjustIndentation,
			insertTextFormat: InsertTextFormat.Snippet,
			textEdit: {
				insert: linePositionedNode.getPositionAsRange(),
				replace: {
					start: linePositionedNode.getBegin(),
					end: { line: linePositionedNode.getEnd().line, character: linePositionedNode.getEnd().character + label.length },
				},
				newText: newText ?? label
			},
			command: command
		}
	}

	static returnOnFirstResult(method: ElementMethod) {
		return method === "onSignatureHelp"
	}

	static createHover(markdown: string, foundNodeByLine: LinePositionedNode<AbstractNode>) {
		return {
			contents: { kind: "markdown", value: markdown },
			range: foundNodeByLine.getPositionAsRange()
		} as Hover
	}
}