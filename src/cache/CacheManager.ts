import { Cache } from './Cache'

class CacheManager {
	public globalCache: Cache<any> = new Cache()
	protected fusionFileAffectedCaches: Cache<any>[] = []

	registerFusionFileAffectedCache(cache: Cache<any>) {
		if (!this.fusionFileAffectedCaches.includes(cache)) {
			this.fusionFileAffectedCaches.push(cache)
		}
	}

	clearByFusionFileUri(uri: string) {
		for (const cache of this.fusionFileAffectedCaches) {
			cache.clearByTag(uri)
		}
	}
}

const cacheManagerInstance = new CacheManager()
export { cacheManagerInstance as CacheManager, CacheManager as CacheManagerClass }