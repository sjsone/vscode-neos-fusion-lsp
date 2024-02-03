import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode';
import { CompletionParams, CompletionItem, CompletionList, CompletionItemKind, InsertTextMode } from 'vscode-languageserver';
import { ElementContext } from './ElementContext';
import { ElementInterface } from './ElementInterface';
import { SemanticCommentType } from '../common/SemanticCommentService';
import { Comment } from 'ts-fusion-parser/out/common/Comment';

export class CommentElement implements ElementInterface<Comment> {
	isResponsible(methodName: keyof ElementInterface<AbstractNode>, node: AbstractNode | undefined): boolean {
		return node instanceof Comment
	}

	async onCompletion(context: ElementContext<CompletionParams, Comment>): Promise<CompletionItem[] | CompletionList | null | undefined> {
		const foundNode = context.foundNodeByLine!
		const completions: CompletionItem[] = []

		const node = foundNode.getNode()
		if (!node.value?.trim().startsWith("@")) return []

		for (const semanticComment of [SemanticCommentType.Ignore, SemanticCommentType.IgnoreBlock]) {
			const label = node.prefix === "//" ? `// ${semanticComment}` : `<!-- ${semanticComment} -->`

			completions.push({
				label,
				kind: CompletionItemKind.Class,
				insertTextMode: InsertTextMode.adjustIndentation,
				insertText: label,
				textEdit: {
					insert: {
						start: foundNode.getBegin(),
						end: foundNode.getEnd(),
					},
					replace: {
						start: foundNode.getBegin(),
						end: { line: foundNode.getEnd().line, character: foundNode.getEnd().character + label.length },
					},
					newText: label
				}
			})
		}

		return completions
	}
}