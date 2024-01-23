import { Range } from 'vscode-languageserver'

export type YamlToken = ColonToken | DashToken | NumberToken | TildeToken | ComplexStringToken | AliasToken | AnchorToken | TagToken | StringToken | StringBlockToken | CommentToken | SymbolToken | NewlineToken | SpaceToken

export enum YamlTokenType {
    Colon = "colon",
    Dash = "dash",
    Number = "number",
    Tilde = "tilde",
    ComplexString = "complexstring",
    Alias = "alias",
    Anchor = "anchor",
    Tag = "tag",
    String = "string",
    StringBlock = "stringblock",
    Comment = "comment",
    Symbol = "symbol",
    Newline = "newline",
    Space = "space",

    Document = "document",
    List = "list"
}

interface AbstractYamlToken {
    type: YamlTokenType
    value?: any
    position: number,
    indent: number
    range?: Range
}

export interface ColonToken extends AbstractYamlToken {
    type: YamlTokenType.Colon,
    value: ':'
}

export interface DashToken extends AbstractYamlToken {
    type: YamlTokenType.Dash,
    value: '-'
}

export interface NumberToken extends AbstractYamlToken {
    type: YamlTokenType.Number
}

export interface TildeToken extends AbstractYamlToken {
    type: YamlTokenType.Tilde,
    value: '~'
}

export interface ComplexStringToken extends AbstractYamlToken {
    type: YamlTokenType.ComplexString
}

export interface AliasToken extends AbstractYamlToken {
    type: YamlTokenType.Alias
}

export interface AnchorToken extends AbstractYamlToken {
    type: YamlTokenType.Anchor
}

export interface TagToken extends AbstractYamlToken {
    type: YamlTokenType.Tag
}

export interface StringToken extends AbstractYamlToken {
    type: YamlTokenType.String
}

export interface StringBlockToken extends AbstractYamlToken {
    type: YamlTokenType.StringBlock
}

export interface CommentToken extends AbstractYamlToken {
    type: YamlTokenType.Comment
}

export interface SymbolToken extends AbstractYamlToken {
    type: YamlTokenType.Symbol
}

export interface NewlineToken extends AbstractYamlToken {
    type: YamlTokenType.Newline
}

export interface SpaceToken extends AbstractYamlToken {
    type: YamlTokenType.Space
}
