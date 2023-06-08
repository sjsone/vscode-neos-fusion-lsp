import * as NodeFs from 'fs'
import { NeosPackage } from '../neos/NeosPackage'
import { XLIFFTranslationFile } from '../translations/XLIFFTranslationFile'
import { getFiles } from './util'

class TranslationService {
	readTranslationsFromPackage(neosPackage: NeosPackage) {
		const basePath = neosPackage.getTranslationsBasePath()
		if (!NodeFs.existsSync(basePath)) return []
		const test = Array.from(getFiles(basePath, ".xlf"))
		const res = test.map(filePath => XLIFFTranslationFile.FromFilePath(neosPackage, filePath, basePath))
		return res
	}
}

const TranslationServiceInstance = new TranslationService
export {
	TranslationServiceInstance as TranslationService
}
