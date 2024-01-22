# Changelog

| Release | Icon |
|---------|------|
| Normal  |  🚀  |
| Preview |  🧪  |

## 🪐🔭 *Upcoming*

## 🧪 0.4.1

- feature: NEOS-ViewContainer
- feature: NEOS-Status bar item with new CommandMenu (to left hand side in the status bar)
- feature: Completion- and Hover-Capabilities for the `Configuration.setting()` EEL-Helper

### ✨ Merged Array Tree

Starting with this release the `ts-fusion-runtime` package is implemented, which provides the (hopefully) same MergedArrayTree as its PHP-Counterpart does.
The MergedArrayTree has already been put to use in the Diagnostic and Completion capabilities which greatly increases their usefulness.
>Properties inside of `@propTypes` do currently not count into the properties of the prototype.

### 🧪 Configuration and `FLOW_CONTEXT`

Another big feature is everything connected to the Configuration. It is now possible to not only change the used `FLOW_CONTEXT` but to also view the Configuration in the new NEOS-ViewContainer.
> This is still experimental.

## 🚀 0.3.??

- feature: WIP Signature Help
- feature: Controller and Actions in `Routing.fusion` if they are in the following format:

    ```neosfusion
    Neos.Neos.LoginController {
      index = Neos.Neos:View.Login {
          site = ${site}
          styles = ${styles}
          username = ${username}
          flashMessages = ${flashMessages}
      }
    }
    ```

## 🚀 0.3.12

- feature: new Icons for Fusion Files ([@typerunningwild](https://www.instagram.com/typerunningwild))

## 🚀 0.3.10

- feature: `@fusion-no-autoinclude-needed` can be used in `Fusion/Root.fusion` files when they are deliberately not auto-included by the configuration
- fix: FQCNs in fusion are now highlighted correctly

## 🧪 0.3.9

- `ts-fusion-parser`: updated to fix issue with closed AFX-Tags

## 🧪 0.3.7

- feature: added builtin `prototype` auto-suggestion
- feature: New action to create Abstract NodeTypes (thanks to Benjamin-K)
- improvement: handling of FQCN in FlowQuery `[instanceof ...]`
- improvement: small improvements to logging errors
- fix: double completion items in AFX

## 🧪 0.3.5

- Diagnostics now show where the fusion parser stopped on an error
- Definition of classes now work in `PropTypes.instanceof`

## 🧪 0.3.1

- XLIFF Support when using shorthand id `I18n.translate("Neos.Redirect...")` or `Translation.translate("Neos.Redirect...")`
  - All translations on hover
  - Definitions on CMD-Click
  - Diagnostics when no translation can be found for the given id

## 🚀 0.2.10

- AFX now supports escaped tag attributes `<div '@meta.test'="test"></div>`
- fix: Error when hovering over some Fusion properties in EEL
- WorkspaceSymbols for NodeTypes now have a `NodeType:` prefix
- Settings: Specific NodeTypes can now be ignored in the diagnostics  

## 🚀 0.2.6

- EEL-Helper argument diagnostics can now be ignored with `@fusion-ignore`
- Diagnostic added to check if `Root.fusion` files get included based on the configuration
- the language server now starts correctly if any `.fusion` file is present in the workspace
- first preparations to merge `neos_context` branch ("Upcoming / Flow Context & Configuration")

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
