import * as NodeFs from "fs"
import * as NodePath from "path"
import { AbstractNode as AbstractEelNode, AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { LiteralNumberNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralNumberNode'
import { LiteralStringNode } from 'ts-fusion-parser/out/dsl/eel/nodes/LiteralStringNode'
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode'
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode'
import { ObjectPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectPathNode'
import { OperationNode } from 'ts-fusion-parser/out/dsl/eel/nodes/OperationNode'
import { EelExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/EelExpressionValue'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/nodes/MetaPathSegment'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { PathSegment } from 'ts-fusion-parser/out/fusion/nodes/PathSegment'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { StringValue } from 'ts-fusion-parser/out/fusion/nodes/StringValue'
import { URI } from 'vscode-uri'
import { DeprecationConfigurationSpecialType } from '../ExtensionConfiguration'
import { FusionWorkspace } from '../fusion/FusionWorkspace'
import { FqcnNode } from '../fusion/node/FqcnNode'
import { PhpClassMethodNode } from '../fusion/node/PhpClassMethodNode'
import { PhpClassNode } from '../fusion/node/PhpClassNode'
import { ResourceUriNode } from '../fusion/node/ResourceUriNode'
import { TranslationShortHandNode } from '../fusion/node/TranslationShortHandNode'
import { Position } from 'vscode-languageserver'
import { FlowConfigurationPathPartNode } from '../fusion/FlowConfigurationPathPartNode'

export interface LineDataCacheEntry {
    lineLengths: number[]
    lineIndents: string[]
}

// TODO: use a real cache [cache-branch]
const lineDataCache: Map<string, LineDataCacheEntry> = new Map

const whitespaceRegex = /^[ \t]+/;

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
    return lineDataCache.set(textUri, buildEntryForLineDataCache(lines))
}

export function buildEntryForLineDataCache(lines: string[]): LineDataCacheEntry {
    const lineLengths = []
    const lineIndents = []

    for (const line of lines) {
        const match = RegExp(whitespaceRegex).exec(line);
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
    return { line: i, character: column } as Position
}

export function* getFiles(dir: string, withExtension = ".fusion", recursive: boolean = true): Generator<string> {
    const directoryEntries = NodeFs.readdirSync(dir, { withFileTypes: true })
    for (const dirent of directoryEntries) {
        if (dirent.isSymbolicLink()) continue
        const res = NodePath.resolve(dir, dirent.name)
        if (dirent.isDirectory()) {
            if (recursive) yield* getFiles(res, withExtension)
        } else if (NodePath.extname(res) === withExtension) {
            yield res
        }
    }
}

const isWindows = typeof process !== 'undefined' && process.platform === 'win32'
enum CharCode {
    Slash = 47,
    A = 65,
    a = 97,
    Z = 90,
    z = 122,
    Colon = 58,
}

export function uriToFsPath(uri: URI, keepDriveLetterCasing: boolean): string {
    let value: string
    if (uri.authority && uri.path.length > 1 && uri.scheme === 'file') {
        // unc path: file://shares/c$/far/boo
        value = `//${uri.authority}${uri.path}`
    } else if (
        uri.path.charCodeAt(0) === CharCode.Slash
        && (uri.path.charCodeAt(1) >= CharCode.A && uri.path.charCodeAt(1) <= CharCode.Z || uri.path.charCodeAt(1) >= CharCode.a && uri.path.charCodeAt(1) <= CharCode.z)
        && uri.path.charCodeAt(2) === CharCode.Colon
    ) {
        if (!keepDriveLetterCasing) {
            // windows drive letter: file:///c:/far/boo
            value = uri.path[1].toLowerCase() + uri.path.substring(2)
        } else {
            value = uri.path.substring(1)
        }
    } else {
        // other path
        value = uri.path
    }

    return isWindows ? value.replace(/\//g, '\\') : value
}

export function uriToPath(uri: string) {
    return uriToFsPath(URI.parse(uri), false)
}

export function pathToUri(path: string) {
    return URI.file(path).toString()
}

export function getPrototypeNameFromNode(node: AbstractNode) {
    if (node instanceof FusionObjectValue) return node.value
    if (node instanceof PrototypePathSegment) return node.identifier
    if (node instanceof FusionObjectValue) return node["value"]
    return null
}

export function isPrototypeDeprecated(workspace: FusionWorkspace, prototypeName: string): string | boolean {
    const configuration = workspace.getConfiguration()
    const deprecations = configuration.code.deprecations.fusion.prototypes ?? {}

    const deprecated = deprecations[prototypeName] ?? false
    if (deprecated === DeprecationConfigurationSpecialType.Ignore) return false
    return deprecated
}

// TODO: use generics
export function mergeObjects(source: unknown, target: unknown) {
    // TODO: rewrite mergeObjects
    // PERF: mergeObject is somewhat slow
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

export function findParent<T extends new (...args: any) => AbstractNode>(node: AbstractNode, parentType: T) {
    let parent = node["parent"]
    while (parent) {
        if (parent instanceof parentType) return <InstanceType<T>>parent
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
    if (node instanceof LiteralStringNode) return node["quotationType"] + node["value"] + node["quotationType"]
    if (node instanceof LiteralNumberNode || node instanceof FusionObjectValue) return node["value"]
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
        case node instanceof TranslationShortHandNode: return 600
        case node instanceof FusionObjectValue: return 500
        case node instanceof PhpClassMethodNode: return 400
        case node instanceof PhpClassNode: return 300
        case node instanceof FqcnNode: return 200
        case node instanceof PrototypePathSegment: return 180
        case node instanceof FlowConfigurationPathPartNode: return 170
        case node instanceof ResourceUriNode: return 160
        case node instanceof ObjectPathNode: return 150
        case node instanceof ObjectNode: return 140
        case node instanceof ObjectStatement: return 100
        default: return 0
    }
}

// TODO: Put the SemanticComment stuff into Service

export enum SemanticCommentType {
    Ignore = "ignore",
    IgnoreBlock = "ignore-block",
    NoAutoincludeNeeded = "no-autoinclude-needed"
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