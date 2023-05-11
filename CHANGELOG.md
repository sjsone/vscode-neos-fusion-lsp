# Changelog

## 🧪 0.2.5

- improved handling of *ActionUri* in `Neos.Neos:Plugin`
- Handling of Node Fusion Prototypes
  - Diagnose Prototypes without a NodeType-File as **Error**
  - QuickAction to create a NodeType-File
- Diagnostic Hint for `<script>` Tags in AFX as a reminder that no Fusion is parsed in them
- Handling of `.props` in `@private`

## 🧪 0.2.3

- fixed multiple `[instanceof ...]`
- fixed [#4](https://github.com/sjsone/vscode-neos-fusion-lsp/issues/4) "EelHelpers with ...$param not working"

## 🧪 0.2.1

- Improved Prototype References

## 🚀 0.2.0

- Fixed handling of Prototypes extending from `Neos.Neos.Plugin`

## 🧪 0.1.63

- Added Badges to Readme
- Improved URI handling by using [`vscode-uri`](https://www.npmjs.com/package/vscode-uri)

## 🧪 0.1.61

- Fixes wrongly encoded file-URIs. Should now work on windows.

## 🧪 0.1.59

- Updated to **TypeScript 5**
- `Neos.Fusion.Form:Form` and `Neos.Neos:Plugin` resolve ActionURIs

## 🧪 0.1.57

Base
