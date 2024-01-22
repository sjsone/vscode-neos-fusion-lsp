import { Cache } from './Cache'
import { CacheManager } from './CacheManager'

export class FusionFileAffectedCache<T> extends Cache<T> {
	constructor(logSuffix?: string) {
		super(logSuffix)
		CacheManager.registerFusionFileAffectedCache(this)
	}
}