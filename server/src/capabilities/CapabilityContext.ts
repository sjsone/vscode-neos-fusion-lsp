import { AbstractNode } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/AbstractNode'
import { TextDocumentPositionParams } from 'vscode-languageserver/node'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { LinePositionedNode } from '../LinePositionedNode'

export interface CapabilityContext<N extends AbstractNode> {
	workspace: FusionWorkspace
	parsedFile: ParsedFusionFile
	foundNodeByLine: LinePositionedNode<N>,
	params: TextDocumentPositionParams
}