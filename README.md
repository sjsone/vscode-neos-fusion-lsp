# 🚧 NEOS Fusion & AFX 🚧

This package is **WIP**

<p align="center">
  <img src="https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/goto_definition.gif?raw=true" alt="animated" />
</p>

> The HTML tokenizer is a modified version of [html-tokenizer](https://github.com/greim/html-tokenizer) by [Greg Reimer](https://twitter.com/greim). You can check the status of the Merge Request [here](https://github.com/greim/html-tokenizer/pull/6).

## Functionality

### [Goto Definition](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition) (*CMD + Click*)

Currently works on **Prototypes**. **Properties** are only supported via name comparison so false positives are more than likely!

Support for EEL will be added in the future.

#### Find References (*Shift + CMD + Click*)

Currently works on **Prototypes** only.

Support for EEL as well as Fusion-Properties will be added in the future.

#### Hover

Currently works on **Prototypes** and **Properties** only and just shows the name. Will provide more information from the yaml-configuration in the future.

Support for EEL will be added in the future.

#### Autocompletion

Currently works on **Prototype-Names** and **Fusion-Properties** only and it does autocomplete them on every point inside the fusion-file. Which is better than typing it by hand but still far from perfect.

Real support (not just string comparison) will be added in the *not so far but still far* future.

## FAQ

#### How does it work?

The language-server relies heavely on the [ts-fusion-parser](https://www.npmjs.com/package/ts-fusion-parser) which is a typescript  port of the "official" [Fusion Parser](https://github.com/neos/neos-development-collection/tree/8.2/Neos.Fusion/Classes/Core).

Essentialy it reads all AST-Nodes from the fusion parser and checks if the curser is on one of these AST-Nodes. If it is, the relevant actions are carried out.

To support AFX a different package is modified ([html-tokenizer](https://github.com/greim/html-tokenizer) by [Greg Reimer](https://twitter.com/greim)) and used to generate AST-Nodes on the fly.

#### Is there a roadmap?

Currently there is no roadmap.  

#### Is an EEL-Implemention planned?

Yes. Including goto-definition on at least `props.` in AFX etc. But for that to work, the [ts-fusion-parser](https://www.npmjs.com/package/ts-fusion-parser) needs to at least produce an AST for EEL. This is currently worked on but will be probably after release **0.1.0**

#### What about EEL-Helper and NodeType-Configuration

It is planned to add Goto-Definition/-References and Hover capability regarding EEL-Helper and NodeTypes. But to fully support it, the files have to be parsed in the correct order. So a composer dependency handling is needed first. This should be optional for EEL-Helper but namespace-handling is a key component to get to the right php-file so these two features are closely related.
