import * as NodeCrypto from 'crypto';
import * as NodeFs from 'fs';
import { FusionParserOptions } from 'ts-fusion-parser';
import { FusionFile } from 'ts-fusion-parser/out/fusion/nodes/FusionFile';
import { Parser } from 'ts-fusion-runtime';
import { InternalArrayTreePart, MergedArrayTree } from 'ts-fusion-runtime/out/core/MergedArrayTree';
import { FusionFileAffectedCache } from '../cache/FusionFileAffectedCache';
import { pathToUri } from '../common/util';
import { NeosPackage } from '../neos/NeosPackage';
import { FusionWorkspace } from './FusionWorkspace';

export class LanguageServerFusionParser extends Parser {

	public rootFusionPaths: Map<NeosPackage, string[]> = new Map

	protected mergedArrayTreeCache: FusionFileAffectedCache<InternalArrayTreePart>

	constructor(
		protected fusionWorkspace: FusionWorkspace
	) {
		super()
		this.mergedArrayTreeCache = new FusionFileAffectedCache('MTA')
	}

	public parseRootFusionFiles(withCachedRootFiles?: string[]) {
		const files = [...this.rootFusionPaths.values()].reduce((carry, rootPaths) => [...carry, ...rootPaths], [])

		if (!withCachedRootFiles || withCachedRootFiles.length === 0) return this.parseFiles(files)

		const cachedFiles = []
		const uncachedFiles = []
		for (const file of files) {
			if (withCachedRootFiles.includes(file)) cachedFiles.push(file)
			else uncachedFiles.push(file)
		}

		const cacheId = this.createCacheId(cachedFiles)
		if (!this.mergedArrayTreeCache.has(cacheId)) {
			this.mergedArrayTreeCache.set(cacheId, this.parseFiles(cachedFiles), cachedFiles.map(cachedFile => pathToUri(cachedFile)))
		}
		return this.parseFiles(uncachedFiles, this.mergedArrayTreeCache.get(cacheId))

	}

	protected createCacheId(cachedFiles: string[]): string {
		const sorted = Array.from(cachedFiles)
		sorted.sort()
		return NodeCrypto.createHash('md5').update(sorted.join('-')).digest('hex')
	}

	public parseFiles(files: string[], mergedArrayTreeUntilNow: { [key: string]: any } = {}) {
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

		const sanitizedContextPathAndFilename = contextPathAndFilename.replace(":", "%3A")

		const parsedFile = this.fusionWorkspace.getParsedFileByContextPathAndFilename(sanitizedContextPathAndFilename)
		if (!parsedFile) throw Error(`TODO: handle unknown but expected ParsedFusionFile: ${contextPathAndFilename}/${sanitizedContextPathAndFilename} // \n ${sourceCode}`)

		return parsedFile.fusionFile
	}
}