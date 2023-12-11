import { Logger } from '../common/Logging'
import { Cache } from './Cache'

class CacheManager extends Logger {
	public globalCache: Cache<any> = new Cache()
	protected fusionFileAffectedCaches: Cache<any>[] = []

	registerFusionFileAffectedCache(cache: Cache<any>) {
		if (!this.fusionFileAffectedCaches.includes(cache)) {
			this.fusionFileAffectedCaches.push(cache)
		}
	}

	clearByFusionFileUri(uri: string) {
		this.logVerbose(`Clearing fusionFileAffectedCaches by uri ${uri}`)
		for (const cache of this.fusionFileAffectedCaches) {
			cache.clearByTag(uri)
		}
	}
}

const cacheManagerInstance = new CacheManager()
export { cacheManagerInstance as CacheManager, CacheManager as CacheManagerClass }