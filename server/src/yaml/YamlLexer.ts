import {
    AliasToken,
    AnchorToken,
    ColonToken,
    CommentToken,
    ComplexStringToken,
    DashToken,
    NewlineToken,
    NumberToken,
    SpaceToken,
    StringBlockToken,
    StringToken,
    SymbolToken,
    TagToken,
    TildeToken,
    YamlToken
} from "./YamlToken"


export class YamlLexer {
    private input: string
    private currentPos: number
    private currentIndent = 0
    private indentLocked = false
    private lastIndentType?: string
    protected extra: any
    protected inLine: boolean

    constructor(input: string, extra: any = undefined) {
        this.input = input
        this.extra = extra
        this.currentPos = 0
        this.inLine = false
    }

    protected getIndent() {
        const indent = this.currentIndent
        this.currentIndent = 0
        return indent
    }

    protected tokenizeColon() {
        const token = { inLine: this.inLine, indent: this.getIndent(), position: this.currentPos, type: "colon", value: ':' } as ColonToken
        this.currentPos++
        return token
    }

    protected tokenizeDash() {
        const token = { inLine: this.inLine, indent: this.getIndent(), position: this.currentPos, type: "dash", value: '-' } as DashToken
        this.currentPos++
        return token
    }

    protected tokenizeNumber() {
        const position = this.currentPos
        let value = ""
        while (this.currentPos < this.input.length && this.input[this.currentPos].match(/[0-9.]/)) {
            value += this.input[this.currentPos]
            this.currentPos++
        }
        return { inLine: this.inLine, indent: this.getIndent(), position, type: "number", value: value } as NumberToken
    }

    protected tokenizeTilde() {
        const token = { inLine: this.inLine, indent: this.getIndent(), position: this.currentPos, type: "tilde", value: '~' } as TildeToken
        this.currentPos++
        return token
    }

    protected tokenizeComplexString(rest: string) {
        const position = this.currentPos
        const value = rest.match(/^([<>a-zA-Z0-9/._\-!:]+?):[ |\n]{1}/m)![1]
        this.currentPos += value.length
        return { inLine: this.inLine, indent: this.getIndent(), position, type: "complex_string", value } as ComplexStringToken
    }

    protected tokenizeImplicitString() {
        const position = this.currentPos

        let value = ""
        while (this.currentPos < this.input.length && this.input[this.currentPos].match(/[a-zA-Z0-9/!*&\\._-]/)) {
            value += this.input[this.currentPos]
            this.currentPos++
        }
        const firstChar = value[0]
        const type = firstChar == '*' ? 'alias' : firstChar == '&' ? 'anchor' : firstChar == '!' ? 'tag' : 'string'

        return { inLine: this.inLine, indent: this.getIndent(), position, type, value } as AliasToken | AnchorToken | TagToken | StringToken
    }

    protected tokenizeStringBlock(char: string) {
        const position = this.currentPos
        this.currentPos++
        let value = char
        while (this.currentPos < this.input.length && this.input[this.currentPos] !== "\n") {
            value += this.input[this.currentPos]
            this.currentPos++
        }
        return { inLine: this.inLine, indent: this.getIndent(), position, type: "string_block", value } as StringBlockToken
    }

    protected tokenizeString(char: string) {
        const position = this.currentPos
        const stringType = char
        this.currentPos++
        let value = ""
        while (this.currentPos < this.input.length && this.input[this.currentPos] !== stringType) {
            if (this.input[this.currentPos] === "\\") {
                this.currentPos++
                if (this.currentPos < this.input.length) value += this.input[this.currentPos]
            } else value += this.input[this.currentPos]
            this.currentPos++
        }
        if (this.input[this.currentPos] === stringType) {
            this.currentPos++
        }
        return { inLine: this.inLine, indent: this.getIndent(), position, type: "string", value: value, stringType } as StringToken
    }

    protected tokenizeComment() {
        const position = this.currentPos
        this.currentPos++
        let value = "#"
        while (this.currentPos < this.input.length && this.input[this.currentPos] !== "\n") {
            value += this.input[this.currentPos]
            this.currentPos++
        }
        return { inLine: this.inLine, indent: this.getIndent(), position, type: "comment", value } as CommentToken
    }

    protected tokenizeSymbol(char: string) {
        const token = { inLine: this.inLine, indent: this.getIndent(), position: this.currentPos, type: "symbol", value: char } as SymbolToken
        this.currentPos++
        return token
    }

    protected tokenizeNewline(char: string) {
        this.currentIndent = 0
        this.indentLocked = false
        const token = { inLine: this.inLine, indent: this.getIndent(), position: this.currentPos, type: "newline", value: char } as NewlineToken
        this.currentPos++
        return token
    }

    protected tokenizeSpace(char: string) {
        if (!this.indentLocked) {
            this.currentIndent++

            if (this.lastIndentType) {
                if (this.lastIndentType !== char) throw new Error("Indent type changed: " + this.input.slice(this.currentPos).slice(0, 40))
            } else {
                this.lastIndentType = char
            }
        }
        let token
        if (this.indentLocked && char === " ") {
            token = { inLine: this.inLine, indent: this.getIndent(), position: this.currentPos, type: "space", value: " " } as SpaceToken
        }
        this.currentPos++

        return token
    }

    public * tokenize(): Generator<YamlToken> {
        let lastPosition = -1

        while (this.currentPos < this.input.length) {
            if (lastPosition === this.currentPos) throw new Error("Loop detected. Last position: " + this.input.slice(this.currentPos).slice(0, 40))
            lastPosition = this.currentPos

            const char = this.input[this.currentPos]
            const rest = this.input.slice(this.currentPos, this.input.indexOf("\n", this.currentPos) + 1)

            if (char !== " " && char !== "\t") this.indentLocked = true

            if (char === ":") {
                this.inLine = true
                yield this.tokenizeColon()
            } else if (char === "-") {
                this.inLine = true
                yield this.tokenizeDash()
            } else if (char.match(/[0-9]/)) {
                this.inLine = true
                yield this.tokenizeNumber()
            } else if (char === "~") {
                this.inLine = true
                yield this.tokenizeTilde()
            } else if ((rest.match(/^([<>a-zA-Z0-9/._\-!:]+?):[ |\n]{1}/m)?.[1]) !== undefined) {
                this.inLine = true
                yield this.tokenizeComplexString(rest)
            } else if (char.match(/[a-zA-Z!*&/\\]/)) {
                this.inLine = true
                yield this.tokenizeImplicitString()
            } else if (char === '"' || char === "'") {
                this.inLine = true
                yield this.tokenizeString(char)
            } else if (char === "|" || char === ">") {
                this.inLine = true
                yield this.tokenizeStringBlock(char)
            } else if (char === "#") {
                this.inLine = true
                yield this.tokenizeComment()
            } else if (char.match(/[[]{},]/)) {
                this.inLine = true
                yield this.tokenizeSymbol(char)
            } else if (char === "\n") {
                yield this.tokenizeNewline(char)
                this.inLine = false
            } else if (char === " " || char === "\t") {

                const token = this.tokenizeSpace(char)
                if (token) yield token
            } else {
                // console.log(`random: "${char}"`)
                this.currentPos++
            }


        }
    }
}


