import * as NodeFs from "fs"
import * as NodePath from "path"
import { AbstractNode as AbstractEelNode } from 'ts-fusion-parser/out/eel/nodes/AbstractNode'
import { LiteralStringNode } from 'ts-fusion-parser/out/eel/nodes/LiteralStringNode'
import { LiteralNumberNode } from 'ts-fusion-parser/out/eel/nodes/LiteralNumberNode'
import { AbstractNode } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/AbstractNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/FusionObjectValue'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PrototypePathSegment'
import { StringValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/StringValue'
import { EelExpressionValue } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/EelExpressionValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/objectTreeParser/ast/PathSegment'
import { ObjectPathNode } from 'ts-fusion-parser/out/eel/nodes/ObjectPathNode'
import { FqcnNode } from './fusion/FqcnNode'
import { PhpClassMethodNode } from './fusion/PhpClassMethodNode'
import { PhpClassNode } from './fusion/PhpClassNode'
import { ResourceUriNode } from './fusion/ResourceUriNode'

export function getLineNumberOfChar(data: string, index: number, debug = false) {
    const perLine = data.split('\n')
    let totalLength = 0
    let column = index
    let i = 0
    for (i; i < perLine.length; i++) {
        totalLength += perLine[i].length + 1
        if (totalLength >= index)
            return { line: i, character: column }
        column -= perLine[i].length + 1
    }
    return { line: i, character: column }
}

export function* getFiles(dir: string, withExtension = ".fusion") {
    const dirents = NodeFs.readdirSync(dir, { withFileTypes: true })
    for (const dirent of dirents) {
        if (dirent.isSymbolicLink()) continue
        const res = NodePath.resolve(dir, dirent.name)
        if (dirent.isDirectory()) {
            yield* getFiles(res)
        } else if (NodePath.extname(res) === withExtension) {
            yield res
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
    if (node instanceof FusionObjectValue) {
        return node.value
    } else if (node instanceof PrototypePathSegment) {
        return node.identifier
    }
    return null
}

export function mergeObjects(source: unknown, target: unknown) {
    // https://gist.github.com/ahtcx/0cd94e62691f539160b32ecda18af3d6?permalink_comment_id=3889214#gistcomment-3889214
    for (const [key, val] of Object.entries(source)) {
        if (val !== null && typeof val === `object`) {
            if (target[key] === undefined) {
                target[key] = new val["__proto__"].constructor()
            }
            mergeObjects(val, target[key])
        } else {
            target[key] = val
        }
    }
    return target // we're replacing in-situ, so this is more for chaining than anything else
}

export function findParent<T extends new (...args: any) => AbstractNode>(node: any, parentType: T): InstanceType<T> | undefined {
    let parent = node["parent"]
    while (parent) {
        if (parent instanceof <any>parentType) {
            return parent
        }
        parent = parent["parent"]
    }
    return undefined
}

export function findUntil<T extends new (...args: any) => AbstractNode>(node: any, condition: (AbstractNode) => boolean): InstanceType<T> | undefined {
    let parent = node["parent"]
    while (parent) {
        if (condition(parent)) {
            return parent
        }
        parent = parent["parent"]
    }
    return undefined
}

export function abstractNodeToString(node: AbstractEelNode | AbstractNode): string | undefined {
    // TODO: This should be node.toString() but for now...
    if (node instanceof StringValue) return `"${node["value"]}"`
    if (node instanceof LiteralNumberNode || node instanceof LiteralStringNode || node instanceof FusionObjectValue) return node["value"]
    if (node instanceof EelExpressionValue) return Array.isArray(node.nodes) ? undefined : abstractNodeToString(<AbstractEelNode>node.nodes)
    return undefined
}

export function getObjectIdentifier(objectStatement: ObjectStatement): string {
    return objectStatement.path.segments.map(segment => segment["identifier"]).join(".")
}

export function getNodeWeight(node: any) {
    switch (true) {
        case node instanceof FusionObjectValue: return 30
        case node instanceof PhpClassMethodNode: return 25
        case node instanceof PhpClassNode: return 20
        case node instanceof FqcnNode: return 17
        case node instanceof ResourceUriNode: return 16
        case node instanceof ObjectPathNode: return 15
        case node instanceof ObjectStatement: return 10
        default: return 0
    }
}