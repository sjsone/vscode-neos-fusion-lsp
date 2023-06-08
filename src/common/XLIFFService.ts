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
}

const XLIFFServiceInstance = new XLIFFService
export {
	XLIFFServiceInstance as XLIFFService
}
