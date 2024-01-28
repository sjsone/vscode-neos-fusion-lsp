import * as NodeFs from "fs"
import * as NodePath from "path"
import { CodeAction, CodeActionKind, CodeActionParams, CreateFile, Diagnostic, Position, TextDocumentEdit, TextEdit, WorkspaceEdit } from 'vscode-languageserver'
import { LanguageServer } from '../LanguageServer'
import { pathToUri } from '../common/util'

const buildDocumentChanges = (fileUri: string, text: string) => [
	CreateFile.create(fileUri, { ignoreIfExists: true }),
	TextDocumentEdit.create({ version: null, uri: fileUri }, [TextEdit.insert(Position.create(0, 0), text)])
]

const buildCodeAction = (title: string, isPreferred: boolean, documentChanges: WorkspaceEdit['documentChanges'], diagnostic: Diagnostic) => ({
	title,
	kind: CodeActionKind.QuickFix,
	isPreferred,
	edit: {
		documentChanges
	},
	diagnostics: [diagnostic]
})

export const createNodeTypeFileAction = (languageServer: LanguageServer, params: CodeActionParams) => {
	const codeActions: CodeAction[] = []

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

		const newFilePath = getNewFilePath(neosPackage.path, nodeTypeName)
		if (NodeFs.existsSync(newFilePath)) continue

		const newFileUri = pathToUri(newFilePath)

		const template = workspace.getConfiguration().code.actions.createNodeTypeConfiguration.template
		const variables: { [key: string]: string } = {
			"{nodeTypeName}": nodeTypeName
		}

		const newText = Object.keys(variables).reduce((prev, cur) => prev.replace(cur, variables[cur]), template)
		const detectAbstractRegEx = workspace.getConfiguration().code.actions.createNodeTypeConfiguration.detectAbstractRegEx
		const nodeTypeCouldBeAbstract = (new RegExp(detectAbstractRegEx)).test(nodeTypeName)

		codeActions.push(buildCodeAction("Create NodeType File", !nodeTypeCouldBeAbstract, buildDocumentChanges(newFileUri, newText), diagnostic))
		if (nodeTypeCouldBeAbstract) codeActions.push(
			buildCodeAction("Create Abstract NodeType File", true, buildDocumentChanges(newFileUri, `${nodeTypeName}:\n  abstract: true`), diagnostic)
		)
	}

	return codeActions
}

const getNewFilePath = (packagePath: string, prototypeName: string) => {
	// TODO: check PHP Version to better predict the new file path
	const nodeTypeFolderPath = NodePath.join(packagePath, "NodeTypes")
	const configurationFolderPath = NodePath.join(packagePath, "Configuration")
	const nodeTypeFolderExists = NodeFs.existsSync(nodeTypeFolderPath)
	const nodeTypeName = prototypeName.split(":").pop()!

	if (nodeTypeFolderExists) return buildNewFilePathForNodeTypesFolder(nodeTypeName, nodeTypeFolderPath)

	return buildNewFilePathForConfigurationFolder(nodeTypeName, configurationFolderPath)
}

const buildNewFilePathForNodeTypesFolder = (nodeTypeName: string, nodeTypeFolderPath: string) => {
	const subFolders = nodeTypeName.split(".")
	const fileName = subFolders.pop()!

	return NodePath.join(nodeTypeFolderPath, ...subFolders, `${fileName}.yaml`)
}

const buildNewFilePathForConfigurationFolder = (nodeTypeName: string, configurationFolderPath: string) => {
	return NodePath.join(configurationFolderPath, `NodeTypes.${nodeTypeName}.yaml`)
}