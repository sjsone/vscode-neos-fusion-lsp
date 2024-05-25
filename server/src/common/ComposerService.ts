import * as NodeFs from "fs"
import * as NodePath from "path"
import { ExtensionConfiguration } from '../ExtensionConfiguration'
import { PackageJsonNotFoundError } from '../error/PackageJsonNotFoundError'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { Logger } from './Logging'
import { uriToPath } from './util'
import * as fastGlob from 'fast-glob'

class ComposerService extends Logger {
	protected parsedComposerJsonByName: { [key: string]: any } = {}
	protected packagePathByName: { [key: string]: string } = {}

	protected alreadyParsed: string[] = []



	getComposerPackagePaths(workspace: FusionWorkspace, configuration: ExtensionConfiguration): Iterable<string> {
		const paths: Set<string> = new Set()

		const workspacePath = uriToPath(workspace.uri)

		const basePath = NodePath.join(workspacePath, configuration.folders.root)

		console.log("basePath", basePath)

		const rootComposerJsonPath = NodePath.join(basePath, "composer.json")
		if (!NodeFs.existsSync(rootComposerJsonPath)) {
			// TODO: show info to user to change folder.root in the settings 
			this.logError(`Could not find root composer.json in ${rootComposerJsonPath}`)
			return []
		}

		const rootComposerJson = JSON.parse(NodeFs.readFileSync(rootComposerJsonPath).toString())
		const rootPackage = {
			name: rootComposerJson.name,
			require: {} as { [key: string]: any }
		}

		console.log("composerJson", rootComposerJson)
		for (const potentialPackageFolder of this.findPackagePaths(basePath, rootComposerJson)) {
			const composerJsonPath = NodePath.join(potentialPackageFolder, "composer.json")
			if (!NodeFs.existsSync(composerJsonPath)) continue

			const composerJson = JSON.parse(NodeFs.readFileSync(composerJsonPath).toString())
			if (composerJson.type === "neos-site") rootPackage.require[composerJson.name] = "0.0.0"
			this.parsedComposerJsonByName[composerJson.name] = composerJson
			this.packagePathByName[composerJson.name] = potentialPackageFolder
		}

		const tree = this.buildRequireTree(rootPackage)
		const treeLevels = this.buildTreeLevels(tree)
		const sortedPackagePaths = treeLevels.reduce((list, level) => {
			for (const name of level) {
				const packagePath = this.packagePathByName[name]
				if (!list.includes(packagePath)) list.unshift(packagePath)
			}
			return list
		}, [])

		const remaining = Array.from(paths).filter(item => !sortedPackagePaths.includes(item))
		return remaining.concat(sortedPackagePaths)
	}

	getComposerJsonByPath(path: string) {
		const nameIndex = Object.values(this.packagePathByName).findIndex(packagePath => packagePath === path)
		if (nameIndex === undefined) return undefined

		const name = Object.keys(this.packagePathByName)[nameIndex]
		return this.parsedComposerJsonByName[name]
	}

	protected * findPackagePaths(basePath: string, rootComposerJson: any) {
		const packageFolders = fastGlob.sync(NodePath.join(basePath, "./Packages/!(Libraries)/*"), { onlyDirectories: true, deep: 2 })

		for (const packageFolder of packageFolders) {
			yield packageFolder
		}

		for (const repositoryName in rootComposerJson.repositories ?? {}) {
			const repository = rootComposerJson.repositories[repositoryName]
			if (repository.type !== "path") continue
			if (typeof repository.url !== "string") continue

			const fullRepositoryUrl = NodePath.join(basePath, repository.url)
			const potentialPackageFolders = fastGlob.sync(fullRepositoryUrl, { onlyDirectories: true })

			for (const potentialPackageFolder of potentialPackageFolders) {
				console.log("potentialPackageFolder", potentialPackageFolder)
				yield potentialPackageFolder
			}
		}
	}

	protected buildTreeLevels(tree: any, treeLevels: any[] = [], currentLevel = 0) {
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
