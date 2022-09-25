import * as NodeFs from "fs"
import * as NodePath from "path"
import { TextDocumentChangeEvent } from 'vscode-languageserver'
import { TextDocument } from "vscode-languageserver-textdocument";
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

	init() {
        const ignoreFolders = ["source/Packages/Libraries"]

		const workspacePath = this.uri.replace("file://", "")
        const sourcePath = NodePath.join(workspacePath, "source")

        const packagesPaths: string[] = []

        const distributionPackagesBasePath = NodePath.join(sourcePath, "DistributionPackages")
        if(NodeFs.existsSync(distributionPackagesBasePath)) {
            const distributionPackages = NodeFs.readdirSync(distributionPackagesBasePath)
            packagesPaths.push(...distributionPackages.map(packageName => NodePath.join(distributionPackagesBasePath, packageName)))     
        }
        
        const packagesBasePath = NodePath.join(sourcePath, "Packages")
        if(NodeFs.existsSync(packagesBasePath)) {
            const packageTypes = NodeFs.readdirSync(packagesBasePath, { withFileTypes: true }).filter(e => e.isDirectory())

            for(const packageType of packageTypes) {
                const packageTypePath = NodePath.join(packagesBasePath, packageType.name)
                if(!NodeFs.existsSync(packageTypePath)) {
                    continue
                }
                const packages = NodeFs.readdirSync(packageTypePath, { withFileTypes: true }).filter(e => e.isDirectory() && !e.isSymbolicLink())
                packagesPaths.push(...packages.map(p => NodePath.join(packageTypePath, p.name)))
            }    
        }
        
        const filteredPackagesPaths = packagesPaths.filter(packagePath => !ignoreFolders.find(ignoreFolder => packagePath.startsWith(NodePath.join(workspacePath, ignoreFolder))))

        for (const packagePath of filteredPackagesPaths) {
            for (const fusionTypeFolder of ['Fusion', 'FusionModules', 'FusionPlugins']) {
                const prefix = `Resources/Private`
                const fusionFolderPath = NodePath.join(packagePath, prefix, fusionTypeFolder)

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