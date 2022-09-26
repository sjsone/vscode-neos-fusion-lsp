import { FusionObjectValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/FusionObjectValue'
import { PrototypePathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PrototypePathSegment'
import { FusionWorkspace } from './FusionWorkspace'

const fileUri = "/Users/simon/Downloads/bauwerk-capital-website-master/source/DistributionPackages/BauwerkCapital.Website/Resources/Private/Fusion/Presentation/Atom"


const fusionWorkspace = new FusionWorkspace("test", `file://${"/Users/simon/Projects/hogast-jobportal"}`)
fusionWorkspace.init({ "folders": { "packages": ["source/DistributionPackages", "source/Packages/Application", "source/Packages/Framework", "source/Packages/Plugins", "source/Packages/Sites"], "fusion": ["Resources/Private/Fusion", "Resources/Private/FusionModules", "Resources/Private/FusionPlugins"], "ignore": ["source/Packages/Libraries", "Packages/Libraries"] }})



const nodesByType = fusionWorkspace.getNodesByType(FusionObjectValue)
// console.log(nodesByType[0])