import { NodePosition } from 'ts-fusion-parser/out/common/NodePosition';
import { FusionFile } from 'ts-fusion-parser/out/fusion/nodes/FusionFile';
import { StatementList } from 'ts-fusion-parser/out/fusion/nodes/StatementList';

export class NonExistingFusionFile extends FusionFile {

	constructor(contextPathAndFileName: string | undefined) {
		const statementList = new StatementList([], [], new NodePosition(0, 0), <FusionFile><unknown>undefined)
		super(statementList, contextPathAndFileName)
		statementList["parent"] = this
	}
}