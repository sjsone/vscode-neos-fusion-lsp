import * as NodeFs from "fs"
import * as NodePath from "path"
import { AbstractNode as AbstractEelNode, AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { LiteralStringNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode'
import { LiteralNumberNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralNumberNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { StringValue } from 'ts-fusion-parser/out/fusion/nodes/StringValue'
import { EelExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/EelExpressionValue'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { FqcnNode } from '../fusion/FqcnNode'
import { PhpClassMethodNode } from '../fusion/PhpClassMethodNode'
import { PhpClassNode } from '../fusion/PhpClassNode'
import { ResourceUriNode } from '../fusion/ResourceUriNode'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/nodes/MetaPathSegment'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { OperationNode } from 'ts-fusion-parser/out/dsl/eel/nodes/OperationNode'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { FusionFileAffectedCache } from '../cache/FusionFileAffectedCache'

export interface LineDataCacheEntry {
    lineLengths: number[]
    lineIndents: string[]
}

const lineDataCache = new FusionFileAffectedCache<LineDataCacheEntry>("LineData")

export function clearLineDataCacheForFile(textUri: string) {
    if (lineDataCache.has(textUri)) lineDataCache.delete(textUri)
}

export function getLinesFromLineDataCacheForFile(textUri: string) {
    return lineDataCache.get(textUri)
}

export function hasLineDataCacheFile(textUri: string) {
    return lineDataCache.has(textUri)
}

export function setLinesFromLineDataCacheForFile(textUri: string, lines: string[]) {
    return lineDataCache.set(textUri, buildEntryForLineDataCache(lines), [textUri])
}

const whitespaceRegex = /^[ \t]+/
export function buildEntryForLineDataCache(lines: string[]): LineDataCacheEntry {
    const lineLengths = []
    const lineIndents = []

    for (const line of lines) {
        const match = line.match(whitespaceRegex)
        lineIndents.push(match ? match[0] : '')
        lineLengths.push(line.length)
    }

    return {
        lineLengths,
        lineIndents
    }
}

export function clearLineDataCache() {
    lineDataCache.clear()
}

export function getLineNumberOfChar(data: string, index: number, textUri: string) {
    if (!lineDataCache.has(textUri)) setLinesFromLineDataCacheForFile(textUri, data.split('\n'))
    const entry = lineDataCache.get(textUri)
    let totalLength = 0
    let column = index
    let i = 0
    for (i; i < entry.lineLengths.length; i++) {
        totalLength += entry.lineLengths[i] + 1
        if (totalLength >= index) return { line: i, character: column }
        column -= entry.lineLengths[i] + 1
    }
    return { line: i, character: column }
}

export function* getFiles(dir: string, withExtension = ".fusion") {
    const directoryEntries = NodeFs.readdirSync(dir, { withFileTypes: true })
    for (const dirent of directoryEntries) {
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
    if (node instanceof FusionObjectValue) return node.value
    else if (node instanceof PrototypePathSegment) return node.identifier
    return null
}

export function isPrototypeDeprecated(workspace: FusionWorkspace, prototypeName: string): string | boolean {
    const configuration = workspace.getConfiguration()
    const deprecations = configuration.code.deprecations.fusion.prototypes ?? {}

    const deprecated = deprecations[prototypeName] ?? false
    if(deprecated === "{ignore}") return false
    return deprecated
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

export function findParent<T extends new (...args: any) => AbstractNode>(node: AbstractNode, parentType: T): InstanceType<T> | undefined {
    let parent = node["parent"]
    while (parent) {
        if (parent instanceof parentType) {
            return <InstanceType<T>>parent
        }
        parent = parent["parent"]
    }
    return undefined
}

export function findUntil<T extends AbstractNode>(node: any, condition: (parent: AbstractNode) => boolean): T | undefined {
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
    if (node instanceof EelExpressionValue) {
        if (Array.isArray(node.nodes)) return undefined
        return `\${${abstractNodeToString(<AbstractEelNode>node.nodes)}}`
    }

    if (node instanceof MetaPathSegment) return "@" + node["identifier"]
    if (node instanceof PathSegment) return node["identifier"]
    if (node instanceof PrototypePathSegment) return `prototype(${node["identifier"]})`
    if (node instanceof ObjectFunctionPathNode) {
        return `${node["value"]}(${node["args"].map(abstractNodeToString).join(", ")})`
    }
    if (node instanceof ObjectPathNode) return node["value"]
    if (node instanceof ObjectNode) {
        return node["path"].map(abstractNodeToString).join(".")
    }
    if (node instanceof OperationNode) {
        return `${abstractNodeToString(node["leftHand"])} ${node["operation"]} ${abstractNodeToString(node["rightHand"])}`
    }

    return undefined
}

export function getObjectIdentifier(objectStatement: ObjectStatement): string {
    return objectStatement.path.segments.map(segment => `${segment instanceof MetaPathSegment ? '@' : ''}${segment["identifier"]}`).join(".")
}

export function getNodeWeight(node: any) {
    switch (true) {
        case node instanceof FusionObjectValue: return 50
        case node instanceof PhpClassMethodNode: return 40
        case node instanceof PhpClassNode: return 30
        case node instanceof FqcnNode: return 20
        case node instanceof PrototypePathSegment: return 18
        case node instanceof ResourceUriNode: return 16
        case node instanceof ObjectPathNode: return 15
        case node instanceof ObjectStatement: return 10
        default: return 0
    }
}

// TODO: Put the SemanticComment stuff into Service

export enum SemanticCommentType {
    Ignore = "ignore",
    IgnoreBlock = "ignore-block"
}

export interface ParsedSemanticComment {
    type: SemanticCommentType
    arguments: string[]
}

export function parseSemanticComment(comment: string): ParsedSemanticComment {
    const semanticCommentRegex = /^ *@fusion-([a-zA-Z0-9_-]+) *(?:\[(.*)\])?$/

    const matches = semanticCommentRegex.exec(comment)
    if (!matches) return undefined

    const rawArguments = matches[2]
    return {
        type: <SemanticCommentType>matches[1],
        arguments: rawArguments ? rawArguments.split(',').filter(Boolean).map(arg => arg.trim()) : []
    }
}

export function checkSemanticCommentIgnoreArguments(propertyName: string, ignoredNames: string[]): boolean {
    if (ignoredNames.length === 0) return true

    const propertyNameParts = propertyName.split('.')
    for (const ignoredName of ignoredNames) {
        const ignoredNameParts = ignoredName.split('.')

        let i = 0
        for (const element of ignoredNameParts) {
            if (propertyNameParts[i] === element) i++
            if (i === ignoredNameParts.length) return true
        }
    }

    return false
}