import * as NodeFs from "fs"
import * as NodePath from "path"

class ComposerService {
	protected parsedComposerJsonByName: { [key: string]: any } = {}

	protected alreadyParsed: string[] = []

	getSortedPackagePaths(packagesPaths: string[]) {
		const pseudoRootPackage = {
			name: "__pseudoRootPackage__",
			require: {}
		}

		for (const packagePath of packagesPaths) {
			const composerJsonPath = NodePath.join(packagePath, "composer.json")
			const composerJson = JSON.parse(NodeFs.readFileSync(composerJsonPath).toString())
			if (composerJson.type === "neos-site") pseudoRootPackage.require[composerJson.name] = "0.0.0"
			this.parsedComposerJsonByName[composerJson.name] = composerJson
		}

		const tree = this.buildRequireTree(pseudoRootPackage)
		console.log(tree)
		for (const name in tree) {
			console.group(`Site: ${name}`)
			for (const test of tree[name]) console.log(test)
			console.groupEnd()
		}

		const treeLevels = this.test(tree)
		console.log("treeLevels", treeLevels)

		return treeLevels.reduce((list, level) => {
			for (const name of level) {
				if (!list.includes(name)) list.unshift(name)
			}
			return list
		}, [])
	}

	protected test(tree: any, treeLevels: any[] = [], currentLevel: number = 0) {
		if (treeLevels[currentLevel] === undefined) treeLevels[currentLevel] = []

		for (const name of Object.keys(tree)) {
			if (!treeLevels[currentLevel].includes(name)) treeLevels[currentLevel].push(name)
			for (const node of tree[name]) {
				this.test(node, treeLevels, currentLevel + 1)
			}
		}

		return treeLevels
	}

	private readComposerJson(packageName: string) {
		return this.parsedComposerJsonByName[packageName]
	}

	private buildRequireTree(composerJson: { [key: string]: any }) {
		const requireTree: any = {}
		const dependencies = composerJson.require

		if (!dependencies || this.alreadyParsed.includes(composerJson.name + '')) return requireTree

		this.alreadyParsed.push(composerJson.name + '')

		for (const packageName of Object.keys(dependencies)) {
			const composerJson = this.readComposerJson(packageName)
			if (!composerJson) continue

			requireTree[packageName] = []

			// for (const include of Object.keys(composerJson.require || {})) {
			// 	requireTree[packageName].push(include)
			// }

			const childTree = this.buildRequireTree(composerJson)

			if (Object.keys(childTree).length > 0) {
				requireTree[packageName].push(childTree)
			}
		}

		return requireTree
	}
}

const composerServiceInstance = new ComposerService()
export { composerServiceInstance as ComposerService }
