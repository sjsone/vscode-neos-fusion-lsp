import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { Definition, DefinitionParams, LocationLink } from 'vscode-languageserver'
import { FqcnNode } from '../fusion/node/FqcnNode'
import { ClassDefinition } from '../neos/NeosPackageNamespace'
import { ElementTextDocumentContext } from './ElementContext'
import { ElementInterface } from './ElementInterface'

export class FqcnElement implements ElementInterface<FqcnNode> {
	isResponsible(methodName: keyof ElementInterface<AbstractNode>, node: AbstractNode | undefined): boolean {
		return node instanceof FqcnNode
	}

	async onDefinition(context: ElementTextDocumentContext<DefinitionParams, FqcnNode>): Promise<LocationLink[] | Definition | null | undefined> {
		const classDefinition: ClassDefinition = context.foundNodeByLine!.getNode().classDefinition
		if (classDefinition === undefined) return null

		return [{
			targetUri: classDefinition.uri,
			targetRange: classDefinition.position,
			targetSelectionRange: classDefinition.position,
			originSelectionRange: {
				start: context.foundNodeByLine!.getBegin(),
				end: {
					character: context.foundNodeByLine!.getBegin().character + context.foundNodeByLine!.getNode().realLength,
					line: context.foundNodeByLine!.getBegin().line
				}
			}
		}]
	}
}