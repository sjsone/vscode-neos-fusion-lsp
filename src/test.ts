import * as NodeFs from "fs";
import * as NodePath from "path";
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue';
import { FusionWorkspace } from './fusion/FusionWorkspace';
import { getLineNumberOfChar } from './util';



const filePath = "/Users/simon/Downloads/bauwerk-capital-website-master/source/DistributionPackages/BauwerkCapital.Website/Classes/Eel/Helper/SearchHelper.php";

const file = NodeFs.readFileSync(filePath).toString();


const start = 22818; 
const end = 22856;
console.log(file.substring(start, end));
// console.log(getLineNumberOfChar(file, start, true))