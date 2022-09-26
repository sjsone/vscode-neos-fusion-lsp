import * as NodeFs from "fs"
import * as NodePath from "path"
import { TextDocumentChangeEvent } from 'vscode-languageserver'
import { TextDocument } from "vscode-languageserver-textdocument";
import { type ExtensionConfiguration } from './configuration';
import { NodeByLine, ParsedFile } from './ParsedFile'
import { getFiles } from './util'

export class FusionWorkspace {
	public uri: string
	public name: string

	public parsedFiles: ParsedFile[] = []
    public filesWithErrors: string[] = []

	constructor(name: string, uri: string) {
		this.name = name
		this.uri = uri
	}

	init(configuration: ExtensionConfiguration) {
        const workspacePath = this.uri.replace("file://", "")

        const ignoreFolders = configuration.folders.ignore
        const packagesRootPaths = configuration.folders.packages.filter(path => NodeFs.existsSync(path))
        const filteredPackagesRootPaths = packagesRootPaths.filter(packagePath => !ignoreFolders.find(ignoreFolder => packagePath.startsWith(NodePath.join(workspacePath, ignoreFolder))))

        const packagesPaths = []

        for(const filteredPackagesRootPath of filteredPackagesRootPaths) {
            for(const folder of NodeFs.readdirSync(filteredPackagesRootPath, {withFileTypes: true})) {
                if(folder.isSymbolicLink() || folder.name.startsWith(".")) continue
                packagesPaths.push(NodePath.join(filteredPackagesRootPath, folder.name))
            }
        }

        for (const packagePath of packagesPaths) {
            for (const packageFusionFolderPath of configuration.folders.fusion) {
                const fusionFolderPath = NodePath.join(packagePath, packageFusionFolderPath)

                if (!NodeFs.existsSync(fusionFolderPath)) {
                    continue
                }

                for (const fusionFilePath of getFiles(fusionFolderPath)) {
                    try {
                        const parsedFile = new ParsedFile(`file://${fusionFilePath}`)
                        this.initParsedFile(parsedFile)
                        this.parsedFiles.push(parsedFile)
                    } catch(e) {
                        this.filesWithErrors.push(`file://${fusionFilePath}`)
                    }
                }
            }
        }
	}

    initParsedFile(parsedFile: ParsedFile, text: string = undefined) {
        if(this.filesWithErrors.includes(parsedFile.uri)) return

        try {
            if(!parsedFile.init(text)) {
                this.filesWithErrors.push(parsedFile.uri)
            }
        }catch(e) {
            this.filesWithErrors.push(parsedFile.uri)
        }
    }

    updateFileByChange(change: TextDocumentChangeEvent<TextDocument>) {
        const file = this.getParsedFileByUri(change.document.uri)
        if(file === undefined) return
        file.clear()
        this.initParsedFile(file, change.document.getText())
    }

    isResponsibleForUri(uri: string) {
        return uri.startsWith(this.uri)
    }

	getParsedFileByUri(uri: string) {
		return this.parsedFiles.find(file => file.uri === uri)
	}

    getNodesByType<T extends abstract new (...args: any) => any>(type: T): Array<{uri: string, nodes: NodeByLine<InstanceType<T>>[]}> {
        const nodes = []
        for(const file of this.parsedFiles) {
            const fileNodes = file.nodesByType.get(type)
            if(fileNodes) {
                nodes.push({
                    uri: file.uri,
                    nodes: fileNodes
                })
            }
        }
        return nodes
    }
}