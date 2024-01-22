import { Logger } from '../common/Logging'

export type CacheTag = string
export type CacheKey = string

export class Cache<T> extends Logger {
	private cacheStore: Map<string, T>
	private keyTags: Map<CacheKey, CacheTag[]>
	private tagKeys: Map<CacheTag, CacheKey[]>

	constructor(logSuffix?: string) {
		super(logSuffix)
		this.cacheStore = new Map<string, T>()
		this.keyTags = new Map<CacheKey, CacheTag[]>()
		this.tagKeys = new Map<CacheTag, CacheKey[]>()
	}

	public set(key: CacheKey, value: T, tags: CacheTag[] = []): void {
		this.logVerbose(`Setting "${key.split('_')[0]}" with tags: `, tags)

		this.cacheStore.set(key, value)

		if (tags.length) {
			this.keyTags.set(key, tags)
			for (const tag of tags) {
				if (!this.tagKeys.has(tag)) this.tagKeys.set(tag, [])
				this.tagKeys.get(tag)!.push(key)
			}
		}
	}

	public has(key: CacheKey): boolean {
		return this.cacheStore.has(key)
	}

	public get(key: CacheKey): T | undefined {
		return this.cacheStore.get(key)
	}

	public retrieve(key: CacheKey, retrieveCallback: () => T, tags: CacheTag[] = []): T | undefined {
		this.logVerbose(`Retrieving for ${key.split('_')[0]} with tags`, tags)

		if (!this.has(key)) {
			const value = retrieveCallback()
			this.set(key, value, tags)
			return value
		}
		return this.get(key)
	}

	public delete(key: CacheKey): boolean {
		if (this.keyTags.has(key)) {
			const keyTags = this.keyTags.get(key)!
			for (const tag of keyTags) {
				const tagKeys = this.tagKeys.get(tag)!
				const index = tagKeys.indexOf(key)
				if (index !== -1) tagKeys.splice(index, 1)
			}
			this.keyTags.delete(key)
		}
		return this.cacheStore.delete(key)
	}

	public clearByTag(tag: CacheTag): void {
		if (this.tagKeys.has(tag)) {
			this.logVerbose(`clearing by tag "${tag}"`)
			const tagKeys = this.tagKeys.get(tag)!
			for (const key of tagKeys) {
				this.cacheStore.delete(key)
				if (this.keyTags.has(key)) {
					const keyTags = this.keyTags.get(key)!
					const index = keyTags.indexOf(tag)
					if (index !== -1) keyTags.splice(index, 1)
					if (keyTags.length === 0) this.keyTags.delete(key)
				}
			}
			this.tagKeys.delete(tag)
		}
	}

	public clear(): void {
		this.cacheStore.clear()
		this.keyTags.clear()
		this.tagKeys.clear()
	}
}
