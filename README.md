# 🚧 NEOS Fusion & AFX 🚧

This package is **WIP**

<p float="left">
  <img width="45%" src="https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/goto_definition.gif?raw=true" alt="animated" />
  <img width="45%" src="https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/goto_eel_helper_method.gif?raw=true" alt="animated" />
  <img width=""
</p>



## Functionality

### [Goto Definition](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition) (*CMD + Click*)

Currently works on **Prototypes** and fusion **Properties** (detected by `this` or `props`)

Support for EEL-Helper is present, but currently not for functions (`q(node)`) only for classes (`String.empty()`).

### Find References (*Shift + CMD + Click*)

Currently works on **Prototypes** only.

![goto image](https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/goto_reference.png?raw=true)

![goto image](https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/goto_reference_all.png?raw=true)

### Hover

Works on properties and prototypes in Fusion and AFX.

Support for EEL-Helper ist present but the description parsing is not working a 100% correct.  

![goto image](https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/hover_props_value_prototype.png?raw=true)

![goto image](https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/hover_props_value_string.png?raw=true)

![goto image](https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/hover_eel_helper_method.png?raw=true)

### Document Symbols (*Shift + CMD + O*)

Every Symbol in the document can be easily accessed.

 ![resource:// capability](https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/symbols_document.png?raw=true)



### Workspace Symbols (*CMD + T*)

Every Prototype can be easily listed via the WorkspaceSymbols. Overwritten Prototypes are also shown. 

![resource:// capability](https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/symbols_workspace.png?raw=true)

### Resource Goto Definition, Completion and Hover

It currently only works when it is a fusion string. When the file is an image it gets preview on hover.



![resource:// capability](https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/resource_completion_and_hover.gif?raw=true)



## Diagnostics

### Fusion Properties

It is based on the definition capability. Because the definition capability does not work perfectly in complex fusion the feature is marked as `experimental`. If it bothers you too much it can be disabled in the extension configuration.  

![goto image](https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/diagnostics_example.gif?raw=true)

### Resource

Described [here](#Resource Goto Definition, Completion and Hover) resource strings are diagnosed when the file cannot be found.

### AFX Tag Names

In AFX a tag has to be closed either by a corresponding closing tag or via self-closing. It will be marked as an Diagnostic-Error if it is not closed.

### EEL-Helper-Arguments

As EEL-Helper are parsed so are the arguments. If an arguments is missing it is marked as an Error. If it has too many it is a warning. 

### Prototypes

Prototypes can be marked as deprecated via the Extension Configuration. The deprecation can be fixed via a Quick-Action in the context menu.

### Empty EEL-Expression

If an empty EEL-Expression `obj = ${}` is used instead of an literal null `obj = null`  it will be marked as deprecated with an Quick-Action-Fix.



## Outline

In the Explorer-View the outline is filled with symbols found in the current document.

![outline](https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/outline.png?raw=true)

## FAQ

### How does it work?

The language-server relies heavily on the [ts-fusion-parser](https://www.npmjs.com/package/ts-fusion-parser) which is a typescript  port of the "official" [Fusion Parser](https://github.com/neos/neos-development-collection/tree/8.2/Neos.Fusion/Classes/Core).

Essentially it reads all AST-Nodes from the fusion parser and checks if the curser is on one of these AST-Nodes. If it is, the relevant actions are carried out.

The AFX and EEL parser is part of the [ts-fusion-parser](https://www.npmjs.com/package/ts-fusion-parser).

### Is there a road map?

Currently there is no road map.  

### What about EEL-Helper and NodeType-Configuration

There is rudimentary support for EEL-Helper. Hover and Goto-Definition is currently (somewhat) supported.

## Known Bugs

- EEL-Helper hover description will parse the first description it can find which may not be the correct one
- EEL-Helper with the same name may be handled incorrectly
