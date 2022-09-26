import { FusionObjectValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/FusionObjectValue'
import { FusionWorkspace } from './FusionWorkspace'

const fusionWorkspace = new FusionWorkspace("test", `file://${"/Users/simon/Projects/hogast-jobportal"}`)
fusionWorkspace.init({
	folders: {
		packages: [
			"source/DistributionPackages",
			"source/Packages/Application",
			"source/Packages/Framework",
			"source/Packages/Plugins",
			"source/Packages/Sites"
		],
		fusion: ["Resources/Private/Fusion", "Resources/Private/FusionModules", "Resources/Private/FusionPlugins"],
		ignore: ["source/Packages/Libraries", "Packages/Libraries"],
		workspaceAsPackageFallback: true
	}
})

const nodesByType = fusionWorkspace.getNodesByType(FusionObjectValue)
// console.log(nodesByType[0])