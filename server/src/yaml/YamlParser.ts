import * as NodeFs from "fs"
import { Position } from 'vscode-languageserver'
import { getLineNumberOfChar, uriToPath } from '../common/util'
import { YamlLexer } from './YamlLexer'
import { AbstractListYamlNode, AbstractYamlNode, DocumentNode, ListYamlNode, ValueNode } from "./YamlNodes"
import { YamlToken, YamlTokenType } from "./YamlToken"

const traverseUpwards = (node: AbstractYamlNode, steps: number) => {
    for (let i = 0; i < steps; i++) {
        if (node['parent'] === undefined) throw Error(`Trying to get parent but it is undefined: ${JSON.stringify(node)}`)
        node = node['parent']!
    }
    return node
}

export class YamlParser {
    protected tokens: YamlToken[]

    protected constructor(tokens: YamlToken[]) {
        this.tokens = tokens
    }

    public static Parse(uri: string) {
        const configurationFileYaml = NodeFs.readFileSync(uriToPath(uri)).toString()
        const yamlLexer = new YamlLexer(configurationFileYaml)
        return (new YamlParser([...yamlLexer.tokenize()])).parse(uri, configurationFileYaml)
    }

    public parse(uri: string, data: string) {
        return this.parseLines(this.buildLines(uri, data))
    }

    protected buildLines(uri: string, data: string) {
        const lines: YamlToken[][] = []
        let line: YamlToken[] = []
        for (const token of this.tokens) {
            const start = getLineNumberOfChar(data, token["position"], uri)
            const end: Position = {
                line: start.line,
                character: start.character + (token.value?.length ?? 0)
            }
            token["range"] = { start, end }
            if (token.type === YamlTokenType.Newline) {
                lines.push(line)
                line = []
            } else {
                if (token.type !== YamlTokenType.Space) line.push(token)
            }
        }
        if (line.length > 0) lines.push(line)
        return lines
    }

    protected parseLines(lines: YamlToken[][]) {
        let currentIndent = -1
        let currentNode: AbstractYamlNode = new DocumentNode()
        let indentStep: undefined | number = undefined

        for (const line of lines) {
            if (line.length === 0) continue

            const firstItem = line[0]
            if (firstItem.type === YamlTokenType.Comment) continue

            if (firstItem.indent < currentIndent) {
                currentNode = traverseUpwards(currentNode, (currentIndent - firstItem.indent) / indentStep!)
            } else if (firstItem.indent > currentIndent) {
                if (indentStep === undefined && firstItem.indent > 0) indentStep = firstItem.indent
            }

            if (this.isStringToken(firstItem)) {
                if (line[1].type !== YamlTokenType.Colon) {
                    continue
                    // console.log("Line", line)
                    // throw new Error("Expected next token to be Colon")
                }

                if (line.length === 2 || (line.length === 3 && (line[2].type === YamlTokenType.Alias || line[2].type === YamlTokenType.Anchor))) {
                    const listNode = new ListYamlNode(firstItem, firstItem.value!)
                    if (!(currentNode instanceof AbstractListYamlNode)) throw new Error(`Expected current Node to be "AbstractListYamlNode". Got ${currentNode.constructor.name}`)
                    currentNode.addNode(firstItem.value!, listNode)
                    currentNode = listNode
                }

                if (line.length === 3) {
                    if (!(currentNode instanceof AbstractListYamlNode)) throw new Error(`Expected current Node to be "AbstractListYamlNode". Got ${currentNode.constructor.name}`)
                    currentNode.addNode(firstItem.value!, new ValueNode(line[2]))
                }
            }

            currentIndent = firstItem.indent
        }

        const documentNode = traverseUpwards(currentNode, currentIndent / indentStep!)
        if (!(documentNode instanceof DocumentNode)) throw new Error(`Excepted "DocumentNode" after parsing. Got: "${documentNode.constructor.name}"`)
        return documentNode

        // return <DocumentNode>currentNode
    }

    protected isStringToken(token: YamlToken) {
        return token.type === YamlTokenType.ComplexString || token.type === YamlTokenType.String
    }
}