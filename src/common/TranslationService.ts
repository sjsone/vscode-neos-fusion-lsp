import * as NodeFs from 'fs'
import { NeosPackage } from '../neos/NeosPackage'
import { XLIFFTranslationFile } from '../translations/XLIFFTranslationFile'
import { getFiles } from './util'

class TranslationService {
	async readTranslationsFromPackage(neosPackage: NeosPackage) {
		const basePath = neosPackage.getTranslationsBasePath()
		if (!NodeFs.existsSync(basePath)) return []

		const translationFilePaths = Array.from(getFiles(basePath, ".xlf"))

		const translationFiles = translationFilePaths.map(async filePath => {
			const translationFile = XLIFFTranslationFile.FromFilePath(neosPackage, filePath, basePath)
			await translationFile.parse()
			return translationFile
		})

		return Promise.all(translationFiles)
	}
}

const TranslationServiceInstance = new TranslationService
export {
	TranslationServiceInstance as TranslationService
}
