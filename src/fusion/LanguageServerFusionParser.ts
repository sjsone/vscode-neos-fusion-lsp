import * as NodeFs from 'fs'
import { FusionParserOptions } from 'ts-fusion-parser'
import { FusionFile } from 'ts-fusion-parser/out/fusion/nodes/FusionFile'
import { Parser } from 'ts-fusion-runtime'
import { MergedArrayTree } from 'ts-fusion-runtime/out/core/MergedArrayTree'
import { NeosPackage } from '../neos/NeosPackage'
import { FusionWorkspace } from './FusionWorkspace'

export class LanguageServerFusionParser extends Parser {

	public rootFusionPaths: Map<NeosPackage, string[]> = new Map

	constructor(
		protected fusionWorkspace: FusionWorkspace
	) {
		super()
	}

	public parseRootFusionFiles() {
		const files = [...this.rootFusionPaths.values()].reduce((carry, rootPaths) => [...carry, ...rootPaths], [])

		return this.parseFiles(files)
	}

	public parseFiles(files: string[], mergedArrayTreeUntilNow: { [key: string]: any } = {}) {
		let mergedArrayTree = new MergedArrayTree(mergedArrayTreeUntilNow)

		for (const file of files) {
			const fusionFile = this.getFusionFile(NodeFs.readFileSync(file).toString(), file)
			// const startTimeMergedArrayTree = performance.now();
			mergedArrayTree = this.getMergedArrayTreeVisitor(mergedArrayTree).visitFusionFile(<any>fusionFile)
			mergedArrayTree.buildPrototypeHierarchy()
			// console.log(`Elapsed time MAT: ${performance.now() - startTimeMergedArrayTree} milliseconds`);
		}

		const tree = mergedArrayTree.getTree()

		return tree
	}


	protected getFusionFile(sourceCode: string, contextPathAndFilename: string | undefined, options?: FusionParserOptions): FusionFile {
		if (!contextPathAndFilename) return super.getFusionFile(sourceCode, contextPathAndFilename, options)

		const sanitizedContextPathAndFilename = contextPathAndFilename.replace(":", "%3A")

		const parsedFile = this.fusionWorkspace.getParsedFileByContextPathAndFilename(sanitizedContextPathAndFilename)
		if (!parsedFile) throw Error(`TODO: handle unknown but expected ParsedFusionFile: ${contextPathAndFilename}/${sanitizedContextPathAndFilename} // \n ${sourceCode}`)

		return parsedFile.fusionFile
	}
}