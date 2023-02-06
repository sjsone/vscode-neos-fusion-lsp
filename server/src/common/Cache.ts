import { Logger } from './Logging'

class Cache<T> extends Logger {
	private cacheStore: Map<string, T>
	private keyTags: Map<string, string[]>
	private tagKeys: Map<string, string[]>

	constructor(logSuffix?: string) {
		super(logSuffix)
		this.cacheStore = new Map<string, T>()
		this.keyTags = new Map<string, string[]>()
		this.tagKeys = new Map<string, string[]>()
	}

	public set(key: string, value: T, tags: string[] = []): void {
		this.cacheStore.set(key, value)

		this.logDebug(`Setting "${key}" with tags: `, tags)

		if (tags.length) {
			this.keyTags.set(key, tags)

			for (const tag of tags) {
				if (!this.tagKeys.has(tag)) this.tagKeys.set(tag, [])

				this.tagKeys.get(tag)!.push(key)
			}
		}
	}

	public has(key: string): boolean {
		return this.cacheStore.has(key)
	}

	public get(key: string): T | undefined {
		return this.cacheStore.get(key)
	}

	public retrieve(key: string, retrieveCallback: () => T, tags: string[] = []): T {
		let value = this.get(key)

		if (!value) {
			value = retrieveCallback()
			this.set(key, value, tags)
		}
		this.logDebug(`Retrieved for ${key} with tags`, tags)

		return value
	}

	public delete(key: string): boolean {
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

	public clearByTag(tag: string): void {
		if (this.tagKeys.has(tag)) {
			this.logDebug(`clearing by tag "${tag}"`)
			const tagKeys = this.tagKeys.get(tag)!
			for (const key of tagKeys) this.delete(key)

			this.tagKeys.delete(tag)
		}
	}

	public clear(): void {
		this.cacheStore.clear()
		this.keyTags.clear()
		this.tagKeys.clear()
	}
}

const GlobalCache = new Cache<any>("GlobalCache")

export { Cache, GlobalCache }