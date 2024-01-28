# Changelog

| Release | Icon |
|---------|------|
| Normal  |  🚀  |
| Preview |  🧪  |

## 🪐🔭 *Upcoming*

- Improved StatusBar interface
- Flow Context & Configuration
  - Select which `FLOW_CONTEXT` the LanguageServer should use to read in the configuration  
  - Autocompletion and Hover for the `Configuration.setting()` EEL-Helper
- Integration of the WIP [`ts-fusion-runtime`](https://www.npmjs.com/package/ts-fusion-runtime) to correctly resolve Fusion properties

## 🚀 0.3.??

- feature: Additional `$` before an EEL-Expression inside AFX will now be diagnosed
- feature: duplicated statements get diagnosed
- feature: Diagnostics can now be separately enabled/disabled
- feature: WIP Signature Help
- feature: Definitions of Controller and Actions in `Routing.fusion`. Actions are suggested. Works only if they are in the following format:

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

- feature: When NodeTypes get created by the QuickAction. The new file will be put into a folder structure following the prototype name. Works only when `NodeTypes` folder is present.
- fix: Server not crashing anymore when package has no `composer.json` file
- fix: changing an YAML-File no longer leads to *all* fusion files being diagnosed
- fix: regression in which the "Create NodeType" QuickAction did not show up

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
