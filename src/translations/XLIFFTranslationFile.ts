import * as NodeFs from 'fs'
import * as NodePath from 'path'
import { Logger } from '../common/Logging'
import { NeosPackage } from '../neos/NeosPackage'
import { type ShortHandIdentifier } from '../common/XLIFFService'


export class XLIFFTranslationFile extends Logger {
	protected sourcePath: string

	constructor(
		protected neosPackage: NeosPackage,
		protected filePath: string,
		protected language: string,
		protected sourceParts: string[]
	) {
		const sourcePath = `${neosPackage.getPackageName()}:${sourceParts.join('.')}`
		super(`<${language}>${sourcePath}`)
		this.sourcePath = sourcePath
	}

	parse() {
		
	}

	matches(shortHandIdentifier: ShortHandIdentifier) {
		return this.sourcePath === `${shortHandIdentifier.packageName}:${shortHandIdentifier.sourceName}`
	}

	static FromFilePath(neosPackage: NeosPackage, filePath: string, basePath: string) {
		const relativePath = NodePath.relative(basePath, filePath)
		const sourceParts = relativePath.split(NodePath.sep)

		const language = sourceParts.shift()
		const translationFileName = sourceParts.pop()
		sourceParts.push(NodePath.parse(translationFileName).name)

		const translationFile = new XLIFFTranslationFile(neosPackage, filePath, language, sourceParts)

		return translationFile
	}
}