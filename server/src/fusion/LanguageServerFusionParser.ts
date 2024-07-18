import * as NodeFs from 'fs'
import * as NodePath from 'path'
import { FusionParserOptions } from 'ts-fusion-parser'
import { FusionFile } from 'ts-fusion-parser/out/fusion/nodes/FusionFile'
import { Parser } from 'ts-fusion-runtime'
import { MergedArrayTree } from 'ts-fusion-runtime/out/core/MergedArrayTree'
import { NeosPackage } from '../neos/NeosPackage'
import { FusionWorkspace } from './FusionWorkspace'
import { ParserError } from 'ts-fusion-parser/out/common/ParserError'

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
			try {
				mergedArrayTree = this.getMergedArrayTreeVisitor(mergedArrayTree, file).visitFusionFile(<any>fusionFile)
				mergedArrayTree.buildPrototypeHierarchy()
			} catch (error) {
				if (!(error instanceof Error)) throw new Error(`Caught Non-Error: ${error}`)
				const parsedFusionFile = this.getParsedFusionFile(file)
				parsedFusionFile.ignoredErrorsByParser.push(new ParserError(error.message, 0))
			}
			// console.log(`Elapsed time MAT: ${performance.now() - startTimeMergedArrayTree} milliseconds`);
		}

		const tree = mergedArrayTree.getTree()

		return tree
	}

	protected getParsedFusionFile(contextPathAndFilename: string, sourceCode: string | undefined = undefined) {
		const sanitizedContextPathAndFilename = contextPathAndFilename.replace(":", "%3A")

		const parsedFile = this.fusionWorkspace.getParsedFileByContextPathAndFilename(sanitizedContextPathAndFilename)
		if (!parsedFile) throw Error(`TODO: handle unknown but expected ParsedFusionFile: ${contextPathAndFilename}/${sanitizedContextPathAndFilename} // \n ${sourceCode}`)

		return parsedFile
	}


	protected getFusionFile(sourceCode: string, contextPathAndFilename: string | undefined, options?: FusionParserOptions): FusionFile {
		if (!contextPathAndFilename) return super.getFusionFile(sourceCode, contextPathAndFilename, options)
		// console.log(`-> ${NodePath.basename(contextPathAndFilename ?? "")}`)
		return this.getParsedFusionFile(contextPathAndFilename, sourceCode).fusionFile
	}
}