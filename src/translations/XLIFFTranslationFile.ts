import { XMLParser } from "fast-xml-parser"
import * as NodeFsPromises from 'fs/promises'
import * as NodePath from 'path'
import { LinePosition } from '../common/LinePositionedNode'
import { Logger } from '../common/Logging'
import { type ShortHandIdentifier } from '../common/XLIFFService'
import { getLineNumberOfChar, pathToUri, setLinesFromLineDataCacheForFile } from '../common/util'
import { NeosPackage } from '../neos/NeosPackage'

export interface XLIFFTransUnit {
	source: string
	target?: string
	'@_id': string
}

export interface TransUnit {
	id: string
	position: LinePosition
	language: string
	source: string
	target?: string
}

export class XLIFFTranslationFile extends Logger {
	protected static XMLParser = new XMLParser({ ignoreAttributes: false })
	protected sourcePath: string
	protected data: undefined | any
	public readonly uri: string

	protected transUnits: Map<string, TransUnit> = new Map

	constructor(
		protected readonly neosPackage: NeosPackage,
		protected readonly filePath: string,
		public readonly language: string,
		protected readonly sourceParts: string[]
	) {
		const sourcePath = `${neosPackage.getPackageName()}:${sourceParts.join('.')}`
		super(`<${language}>${sourcePath}`)
		this.sourcePath = sourcePath
		this.uri = pathToUri(this.filePath)
	}

	async parse() {
		this.transUnits.clear()
		const xmlTextBuffer = await NodeFsPromises.readFile(this.filePath)
		this.data = XLIFFTranslationFile.XMLParser.parse(xmlTextBuffer)
		const xmlText = xmlTextBuffer.toString()
		setLinesFromLineDataCacheForFile(this.uri, xmlText.split("\n"))
		const XLIFFTransUnits: XLIFFTransUnit[] = this.data?.xliff.file.body["trans-unit"] ?? []
		this.logVerbose(`Found ${XLIFFTransUnits.length} TransUnits`)
		for (const transUnit of XLIFFTransUnits) {
			const offset = xmlText.indexOf(`id="${transUnit["@_id"]}"`)
			const position = getLineNumberOfChar(xmlText, offset, this.uri)

			this.transUnits.set(transUnit["@_id"], {
				source: this.getTextFromSourceOrTarget(transUnit.source),
				target: this.getTextFromSourceOrTarget(transUnit.target),
				id: transUnit["@_id"],
				position,
				language: this.language
			})

			this.logDebug(` \\- ${transUnit["@_id"]}`)
		}
	}

	protected getTextFromSourceOrTarget(sourceOrTarget: string | { '#text': string, '@_state': string } | undefined) {
		if (sourceOrTarget === undefined) return undefined
		if (typeof sourceOrTarget === "string") return sourceOrTarget
		return sourceOrTarget['#text']
	}

	async getId(identifier: string): Promise<undefined | TransUnit> {
		if (this.data === undefined) await this.parse()
		return this.transUnits.get(identifier)
	}

	async matches(shortHandIdentifier: ShortHandIdentifier) {
		if (this.sourcePath !== `${shortHandIdentifier.packageName}:${shortHandIdentifier.sourceName}`) return false
		return await this.getId(shortHandIdentifier.translationIdentifier) !== undefined
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