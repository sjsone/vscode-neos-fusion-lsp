import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { TransUnit, XLIFFTranslationFile } from '../translations/XLIFFTranslationFile'

export interface ShortHandIdentifier {
	packageName: string
	sourceName: string
	translationIdentifier: string
}

class XLIFFService {
	public readShortHandIdentifier(shortHandIdentifier: string): ShortHandIdentifier {
		const [packageName, sourceName, translationIdentifier] = shortHandIdentifier.split(":")
		return {
			packageName,
			sourceName,
			translationIdentifier
		}
	}

	public async getMatchingTranslations(workspace: FusionWorkspace, shortHandIdentifier: ShortHandIdentifier) {
		const matching: TransUnit[] = []
		for (const translationFile of workspace.translationFiles) {
			if (await translationFile.matches(shortHandIdentifier)) {
				const transUnit = await translationFile.getId(shortHandIdentifier.translationIdentifier)
				if (transUnit) matching.push(transUnit)
			}
		}
		return matching
	}

	public async getMatchingTranslationFiles(workspace: FusionWorkspace, shortHandIdentifier: ShortHandIdentifier) {
		const matching: XLIFFTranslationFile[] = []
		for (const translationFile of workspace.translationFiles) {
			if (await translationFile.matches(shortHandIdentifier)) matching.push(translationFile)
		}
		return matching
	}
}

const XLIFFServiceInstance = new XLIFFService
export {
	XLIFFServiceInstance as XLIFFService
}
