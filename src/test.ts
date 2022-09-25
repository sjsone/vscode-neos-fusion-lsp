import { FusionObjectValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/FusionObjectValue'
import { PrototypePathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PrototypePathSegment'
import { FusionWorkspace } from './FusionWorkspace'

const fileUri = "/Users/simon/Downloads/bauwerk-capital-website-master/source/DistributionPackages/BauwerkCapital.Website/Resources/Private/Fusion/Presentation/Atom"


const fusionWorkspace = new FusionWorkspace("test", `file://${"/Users/simon/Projects/hogast-jobportal"}`)
fusionWorkspace.init()



const nodesByType = fusionWorkspace.getNodesByType(FusionObjectValue)
// console.log(nodesByType[0])