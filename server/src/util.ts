import * as NodeFs from "fs"
import * as NodePath from "path"

export function getLineNumberOfChar(data: string, index: number, name: string = "") {
    const debug = name === "Test.Test:Component"

    const perLine = data.split('\n');
    if(debug) console.log(`  perLine.length ${perLine.length}`)
    let total_length = 0;
    let column = index+1
    let i = 0
    for (i; i < perLine.length; i++) {
        total_length += perLine[i].length+1;
        if(debug) console.log(` [${i}] total_length`, total_length)
        if (total_length >= index)
            return {line: i+1, column}
        column -= perLine[i].length+1
        if(debug) console.log(` [${i}] column`, column)
    }
    return {line: i+1, column}
}


export function* getFiles(dir) {
    const dirents = NodeFs.readdirSync(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        if(dirent.isSymbolicLink()) continue
        const res = NodePath.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            yield* getFiles(res);
        } else if (NodePath.extname(res) === ".fusion") {
            yield res;
        }
    }
}