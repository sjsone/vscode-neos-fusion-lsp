import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { TextDocumentPositionParams, WorkspaceSymbolParams } from 'vscode-languageserver/node'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { LinePositionedNode } from '../common/LinePositionedNode'

export type CapabilityContext<N extends AbstractNode = AbstractNode> = ParsedFileCapabilityContext<N> | WorkspacesCapabilityContext

export interface WorkspacesCapabilityContext {
	workspaces: FusionWorkspace[],
	params: WorkspaceSymbolParams
}

export interface ParsedFileCapabilityContext<N extends AbstractNode> {
	workspace: FusionWorkspace
	parsedFile: ParsedFusionFile
	foundNodeByLine?: LinePositionedNode<N>,
	params: TextDocumentPositionParams
}