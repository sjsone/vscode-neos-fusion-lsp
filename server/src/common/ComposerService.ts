import * as NodeFs from "fs"
import * as NodePath from "path"

class ComposerService {
	protected parsedComposerJsonByName: { [key: string]: any } = {}
	protected packagePathByName: { [key: string]: string } = {}

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
			this.packagePathByName[composerJson.name] = packagePath
		}

		const tree = this.buildRequireTree(pseudoRootPackage)
		const treeLevels = this.buildTreeLevels(tree)
		const sortedPackagePaths = treeLevels.reduce((list, level) => {
			for (const name of level) {
				const packagePath = this.packagePathByName[name]
				if (!list.includes(packagePath)) list.unshift(packagePath)
			}
			return list
		}, [])

		const remaining = packagesPaths.filter(item => !sortedPackagePaths.includes(item));
		return sortedPackagePaths.concat(remaining);
	}

	getComposerJsonByPath(path: string) {
		const nameIndex = Object.values(this.packagePathByName).findIndex(packagePath => packagePath === path)
		if (nameIndex === undefined) return undefined

		const name = Object.keys(this.packagePathByName)[nameIndex]
		return this.parsedComposerJsonByName[name]
	}

	protected buildTreeLevels(tree: any, treeLevels: any[] = [], currentLevel: number = 0) {
		if (treeLevels[currentLevel] === undefined) treeLevels[currentLevel] = []

		for (const name of Object.keys(tree)) {
			if (!treeLevels[currentLevel].includes(name)) treeLevels[currentLevel].push(name)
			for (const node of tree[name]) {
				this.buildTreeLevels(node, treeLevels, currentLevel + 1)
			}
		}

		return treeLevels
	}

	protected readComposerJson(packageName: string) {
		return this.parsedComposerJsonByName[packageName]
	}

	protected buildRequireTree(composerJson: { [key: string]: any }) {
		const requireTree: any = {}
		const dependencies = composerJson.require

		if (!dependencies || this.alreadyParsed.includes(composerJson.name + '')) return requireTree

		this.alreadyParsed.push(composerJson.name + '')

		for (const packageName of Object.keys(dependencies)) {
			const composerJson = this.readComposerJson(packageName)
			if (!composerJson) continue

			requireTree[packageName] = []

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
