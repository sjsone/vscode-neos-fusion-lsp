import * as NodeFs from "fs"
import * as NodePath from "path"
import { AbstractNode } from 'ts-fusion-parser/out/core/objectTreeParser/ast/AbstractNode';
import { FusionObjectValue } from 'ts-fusion-parser/out/core/objectTreeParser/ast/FusionObjectValue';
import { PrototypePathSegment } from 'ts-fusion-parser/out/core/objectTreeParser/ast/PrototypePathSegment';

export function getLineNumberOfChar(data: string, index: number, name: string = "") {
    const debug = name === "Test.Test:Component"

    const perLine = data.split('\n');
    if (debug) console.log(`  perLine.length ${perLine.length}`)
    let total_length = 0;
    let column = index + 1
    let i = 0
    for (i; i < perLine.length; i++) {
        total_length += perLine[i].length + 1;
        if (debug) console.log(` [${i}] total_length`, total_length)
        if (total_length >= index)
            return { line: i + 1, column }
        column -= perLine[i].length + 1
        if (debug) console.log(` [${i}] column`, column)
    }
    return { line: i + 1, column }
}

export function* getFiles(dir: string, withExtension: string = ".fusion") {
    const dirents = NodeFs.readdirSync(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        if (dirent.isSymbolicLink()) continue
        const res = NodePath.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            yield* getFiles(res);
        } else if (NodePath.extname(res) === withExtension) {
            yield res;
        }
    }
}

export function uriToPath(uri: string) {
    return uri.replace("file://", "")
}

export function pathToUri(path: string) {
    return "file://" + path
}

export function getPrototypeNameFromNode(node: AbstractNode) {
    if(node instanceof FusionObjectValue) {
        return node.value
    } else if (node instanceof PrototypePathSegment) {
        return node.identifier
    }
    return null
}

export function mergeObjects(source: Object, target: Object) {
	// https://gist.github.com/ahtcx/0cd94e62691f539160b32ecda18af3d6?permalink_comment_id=3889214#gistcomment-3889214
    for (const [key, val] of Object.entries(source)) {
        if (val !== null && typeof val === `object`) {
            if (target[key] === undefined) {
                target[key] = new val["__proto__"].constructor();
            }
            mergeObjects(val, target[key]);
        } else {
            target[key] = val;
        }
    }
    return target; // we're replacing in-situ, so this is more for chaining than anything else
}