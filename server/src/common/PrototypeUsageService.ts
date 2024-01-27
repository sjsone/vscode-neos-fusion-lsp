import { ParsedFusionFile } from '../fusion/ParsedFusionFile'
import { InternalArrayTreePart } from 'ts-fusion-runtime/out/core/MergedArrayTree'

class PrototypeUsageService {
	public buildPrototypeUsageTree(file: ParsedFusionFile, mergedArrayTree: InternalArrayTreePart) {
		const prototypes = mergedArrayTree.__prototypes
		if (!prototypes) return undefined

		const cache: { [key: string]: string[] } = {}

		const testPrototype = (name: string) => {
			const names: string[] = []

			if (Array.isArray(cache[name])) {
				return cache[name]
			}

			const pushIntoNames = (name: string | { __value: string }) => {
				if (typeof name !== "string") {
					name = name.__value
				}

				if (prototypes[name] && !names.includes(name)) names.push(name)
			}

			const testContent = (data: { [key: string]: any } = {}) => {
				if ("__prototypeObjectName" in data && data["__prototypeObjectName"]) {
					pushIntoNames(data["__prototypeObjectName"])
				}

				if ("__objectType" in data && data["__objectType"]) {
					pushIntoNames(data["__objectType"])
				}

				for (const key in data) {
					const value = data[key]
					if (value === null) continue
					if (key.startsWith("__") && key !== "__meta") continue
					if (typeof value !== "object") continue
					testContent(value)
				}
			}

			const prototype = prototypes[name]
			if (!prototype) return names

			if ("__prototypeChain" in prototype) for (const prototypeChainName of prototype["__prototypeChain"] ?? []) {
				for (const chainName of testPrototype(prototypeChainName)) pushIntoNames(chainName)
			}

			testContent(prototype)

			cache[name] = names

			return names
		}

		const start = performance.now();

		for (const prototypeDefinition of [...file.prototypeCreations, ...file.prototypeOverwrites]) {
			const prototypeName = prototypeDefinition.getNode().identifier
			const names = testPrototype(prototypeName)

			console.log("usages " + prototypeName, names)
		}


		const end = performance.now();
		console.log(`Execution time: ${end - start} ms`);
	}
}

const prototypeUsageService = new PrototypeUsageService
export { prototypeUsageService as PrototypeUsageService }