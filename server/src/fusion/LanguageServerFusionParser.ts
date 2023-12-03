import { FusionParserOptions } from 'ts-fusion-parser';
import { FusionFile } from 'ts-fusion-parser/out/fusion/nodes/FusionFile';
import { Parser } from 'ts-fusion-runtime';
import { FusionWorkspace } from './FusionWorkspace';
import { pathToUri } from '../common/util';
import { MergedArrayTree } from 'ts-fusion-runtime/out/core/MergedArrayTree';
import * as NodeFs from 'fs'

export class LanguageServerFusionParser extends Parser {

	constructor(
		protected fusionWorkspace: FusionWorkspace
	) {
		super()
	}

	parseFiles(files: string[]) {
		let mergedArrayTreeUntilNow: { [key: string]: any } = {}
		let mergedArrayTree = new MergedArrayTree(mergedArrayTreeUntilNow);

		for (const file of files) {
			const fusionFile = this.getFusionFile(NodeFs.readFileSync(file).toString(), file);
			// const startTimeMergedArrayTree = performance.now();
			mergedArrayTree = this.getMergedArrayTreeVisitor(mergedArrayTree).visitFusionFile(<any>fusionFile);
			mergedArrayTree.buildPrototypeHierarchy();
			// console.log(`Elapsed time MAT: ${performance.now() - startTimeMergedArrayTree} milliseconds`);
		}

		const tree = mergedArrayTree.getTree();

		return tree
	}


	protected getFusionFile(sourceCode: string, contextPathAndFilename: string | undefined, options?: FusionParserOptions): FusionFile {
		if (!contextPathAndFilename) return super.getFusionFile(sourceCode, contextPathAndFilename, options)

		const parsedFile = this.fusionWorkspace.getParsedFileByContextPathAndFilename(contextPathAndFilename)
		if (!parsedFile) throw Error(`TODO: handle unknown but expected ParsedFusionFile: ${contextPathAndFilename}`)

		return parsedFile.fusionFile
	}
}