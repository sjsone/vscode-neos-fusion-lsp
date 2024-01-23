import { SpaceToken, YamlToken, YamlTokenType } from "./YamlToken"

export abstract class AbstractYamlNode {
    protected type!: YamlTokenType
    protected parent?: AbstractYamlNode
    protected token: YamlToken

    constructor(token: YamlToken) {
        this.token = token
    }
}

export abstract class AbstractListYamlNode extends AbstractYamlNode {
    protected nodes: { [key: string]: AbstractYamlNode } = {}

    public addNode(key: string, node: AbstractYamlNode) {
        this.nodes[key] = node
        node["parent"] = this
    }
}

export class ListYamlNode extends AbstractListYamlNode {
    protected type!: YamlTokenType.List
    protected name: string
    constructor(token: YamlToken, name: string) {
        super(token)
        this.name = name
    }
}

export class DocumentNode extends AbstractListYamlNode {
    protected type = YamlTokenType.Document

    constructor() {
        super(<SpaceToken><unknown>undefined)
    }
}

export class ValueNode extends AbstractYamlNode {
    protected value: any

    constructor(token: YamlToken) {
        super(token)
        this.type = token.type
        this.value = token.value
    }
}

export class CommentNode extends AbstractYamlNode {
    protected type = YamlTokenType.Comment
}