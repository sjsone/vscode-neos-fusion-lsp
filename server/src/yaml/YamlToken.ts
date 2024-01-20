export type YamlToken = ColonToken | DashToken | NumberToken | TildeToken | ComplexStringToken | AliasToken | AnchorToken | TagToken | StringToken | StringBlockToken | CommentToken | SymbolToken | NewlineToken | SpaceToken


interface AbstractYamlToken {
    type: any
    value?: any
    position: number,
    indent: number,
    inLine: boolean
}

export interface ColonToken extends AbstractYamlToken {
    type: "colon",
    value: ':'
}

export interface DashToken extends AbstractYamlToken {
    type: "dash",
    value: '-'
}

export interface NumberToken extends AbstractYamlToken {
    type: "number"
}

export interface TildeToken extends AbstractYamlToken {
    type: "tilde",
    value: '~'
}

export interface ComplexStringToken extends AbstractYamlToken {
    type: "complex_string"
}

export interface AliasToken extends AbstractYamlToken {
    type: "alias"
}

export interface AnchorToken extends AbstractYamlToken {
    type: "anchor"
}

export interface TagToken extends AbstractYamlToken {
    type: "tag"
}

export interface StringToken extends AbstractYamlToken {
    type: "string"
    stringType: "'" | '"'
}

export interface StringBlockToken extends AbstractYamlToken {
    type: "string_block"
}

export interface CommentToken extends AbstractYamlToken {
    type: "comment"
}

export interface SymbolToken extends AbstractYamlToken {
    type: "symbol"
}

export interface NewlineToken extends AbstractYamlToken {
    type: "newline"
}

export interface SpaceToken extends AbstractYamlToken {
    type: "space"
}
