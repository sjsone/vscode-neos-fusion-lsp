import * as NodeFs from "fs";
import * as NodePath from "path";
import { CodeAction, CodeActionKind, CodeActionParams, CreateFile, Position, TextDocumentEdit, TextEdit } from 'vscode-languageserver';
import { LanguageServer } from '../LanguageServer';
import { pathToUri } from '../common/util';


export const createNodeTypeFileAction = (languageServer: LanguageServer, params: CodeActionParams) => {
	const codeActions: CodeAction[] = [];

	for (const diagnostic of params.context.diagnostics) {
		const nodeTypeName = diagnostic.data?.nodeTypeName
		if (typeof nodeTypeName !== "string") continue

		const diagnosticRelatedInformation = diagnostic.relatedInformation?.[0]
		if (!diagnosticRelatedInformation) continue
		const uri = diagnosticRelatedInformation.location.uri

		const workspace = languageServer.getWorkspaceForFileUri(uri)
		if (!workspace) continue

		const neosPackage = workspace.neosWorkspace.getPackageByUri(uri)
		if (!neosPackage) continue

		const newFilePath = getNewFilePath(neosPackage["path"], nodeTypeName)
		if (NodeFs.existsSync(newFilePath)) continue

		const newFileUri = pathToUri(newFilePath)

		// TODO: Make template editable/configurable
		// TODO: Predict Mixins/SuperTypes

		const template = workspace.getConfiguration().code.actions.createNodeTypeConfiguration.template
		const variables = {
			"{nodeTypeName}": nodeTypeName
		}

		const newText = Object.keys(variables).reduce((prev, cur) => {
			return prev.replace(cur, variables[cur])
		}, template)

		codeActions.push({
			title: "Create NodeType File",
			kind: CodeActionKind.QuickFix,
			isPreferred: true,
			edit: {
				documentChanges: [
					CreateFile.create(newFileUri, { ignoreIfExists: true }),
					TextDocumentEdit.create({ version: null, uri: newFileUri }, [TextEdit.insert(Position.create(0, 0), newText)])
				]
			},
			diagnostics: [diagnostic]
		})
	}

	return codeActions
}

function getNewFilePath(packagePath: string, prototypeName: string) {
	// TODO: check PHP Version to better predict the new file path
	const nodeTypeFolderPath = NodePath.join(packagePath, "NodeTypes")
	const configurationFolderPath = NodePath.join(packagePath, "Configuration")
	const nodeTypeFolderExists = NodeFs.existsSync(nodeTypeFolderPath)
	const nodeTypeName = prototypeName.split(":").pop()

	return nodeTypeFolderExists ? NodePath.join(nodeTypeFolderPath, `${nodeTypeName}.yaml`) : NodePath.join(configurationFolderPath, `NodeTypes.${nodeTypeName}.yaml`)
}