import * as NodeFs from 'fs'
import { NeosPackage } from '../neos/NeosPackage'
import { XLIFFTranslationFile } from '../translations/XLIFFTranslationFile'
import { getFiles } from './util'

class TranslationService {
	readTranslationsFromPackage(neosPackage: NeosPackage) {
		const basePath = neosPackage.getTranslationsBasePath()
		if (!NodeFs.existsSync(basePath)) return []
		const translationFilePaths = Array.from(getFiles(basePath, ".xlf"))
		return translationFilePaths.map(filePath => {
			const translationFile = XLIFFTranslationFile.FromFilePath(neosPackage, filePath, basePath)
			translationFile.parse().catch(error => { })
			return translationFile
		})
	}
}

const TranslationServiceInstance = new TranslationService
export {
	TranslationServiceInstance as TranslationService
}
