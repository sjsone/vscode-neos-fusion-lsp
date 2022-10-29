import * as NodeFs from "fs"
import * as NodePath from "path"
import { TextDocumentChangeEvent } from 'vscode-languageserver'
import { TextDocument } from "vscode-languageserver-textdocument"
import { LoggingLevel, type ExtensionConfiguration } from '../ExtensionConfiguration'
import { LinePositionedNode } from '../LinePositionedNode'
import { NeosWorkspace } from '../neos/NeosWorkspace'
import { ParsedFusionFile } from './ParsedFusionFile'
import { getFiles, pathToUri, uriToPath } from '../util'
import { Logger, LogService } from '../Logging'
import { LanguageServer } from '../LanguageServer'

export class FusionWorkspace extends Logger {
    public uri: string
    public name: string
    public languageServer: LanguageServer

    public neosWorkspace: NeosWorkspace

    public parsedFiles: ParsedFusionFile[] = []
    public filesWithErrors: string[] = []

    constructor(name: string, uri: string, languageServer: LanguageServer) {
        super(name)
        this.name = name
        this.uri = uri
        this.languageServer = languageServer
    }

    getUri() {
        return this.uri
    }

    init(configuration: ExtensionConfiguration) {
        this.clear()
        this.languageServer.sendProgressNotificationCreate("fusion_workspace_init", "Fusion")
        const workspacePath = uriToPath(this.uri)

        const ignoreFolders = configuration.folders.ignore
        const packagesRootPaths = configuration.folders.packages.filter(path => NodeFs.existsSync(path))
        const filteredPackagesRootPaths = packagesRootPaths.filter(packagePath => !ignoreFolders.find(ignoreFolder => packagePath.startsWith(NodePath.join(workspacePath, ignoreFolder))))

        const packagesPaths = []

        for (const filteredPackagesRootPath of filteredPackagesRootPaths) {
            for (const folder of NodeFs.readdirSync(filteredPackagesRootPath, { withFileTypes: true })) {
                // TODO: make symbolic link following and hidden folder configurable
                if (folder.isSymbolicLink() || folder.name.startsWith(".") || !folder.isDirectory()) continue
                packagesPaths.push(NodePath.join(filteredPackagesRootPath, folder.name))
            }
        }

        if (packagesPaths.length === 0 && configuration.folders.workspaceAsPackageFallback) {
            packagesPaths.push(workspacePath)
        }

        this.neosWorkspace = new NeosWorkspace(workspacePath, this.name)
        for (const packagePath of packagesPaths) {
            this.neosWorkspace.addPackage(packagePath)
        }
        this.neosWorkspace.initEelHelpers()


        const incrementPerPackage = 100 / packagesPaths.length

        for (const packagePath of packagesPaths) {
            this.languageServer.sendProgressNotificationUpdate("fusion_workspace_init", {
                message: `Package: ${packagePath}`
            })
            for (const packageFusionFolderPath of configuration.folders.fusion) {
                const fusionFolderPath = NodePath.join(packagePath, packageFusionFolderPath)
                if (!NodeFs.existsSync(fusionFolderPath)) continue

                for (const fusionFilePath of getFiles(fusionFolderPath)) {
                    try {
                        const parsedFile = new ParsedFusionFile(pathToUri(fusionFilePath), this)
                        this.initParsedFile(parsedFile)
                        this.parsedFiles.push(parsedFile)
                    } catch (e) {
                        this.filesWithErrors.push(pathToUri(fusionFilePath))
                    }
                }
            }
            this.languageServer.sendProgressNotificationUpdate("fusion_workspace_init", {
                increment: incrementPerPackage
            })
        }

        this.logInfo(`Successfully parsed ${this.parsedFiles.length} fusion files. `)
        if (this.filesWithErrors.length > 0) {
            this.logInfo(`  Could not parse ${this.filesWithErrors.length} files due to errors`)

            if (LogService.isLogLevel(LoggingLevel.Verbose)) {
                this.logVerbose(`  Files:`)
                for (const fileWithError of this.filesWithErrors) {
                    this.logVerbose(`    ${fileWithError}`)
                }
            }
        }

        this.languageServer.sendProgressNotificationFinish("fusion_workspace_init")
    }

    initParsedFile(parsedFile: ParsedFusionFile, text: string = undefined) {
        if (this.filesWithErrors.includes(parsedFile.uri)) return false

        try {
            parsedFile.clear()
            if (!parsedFile.init(text)) {
                this.filesWithErrors.push(parsedFile.uri)
                return false
            }
            const diagnostics = parsedFile.diagnose()
            if (diagnostics) {
                this.languageServer.sendDiagnostics({
                    uri: parsedFile.uri,
                    diagnostics
                })
            }
            return true
        } catch (e) {
            this.filesWithErrors.push(parsedFile.uri)
        }

        return false
    }

    async updateFileByChange(change: TextDocumentChangeEvent<TextDocument>) {
        const file = this.getParsedFileByUri(change.document.uri)
        if (file === undefined) return
        const initSuccess = this.initParsedFile(file, change.document.getText())
        if (initSuccess) {
            const diagnostics = await file.diagnose()
            if (diagnostics) {
                this.languageServer.sendDiagnostics({
                    uri: file.uri,
                    diagnostics
                })
            }
        }
    }

    isResponsibleForUri(uri: string) {
        return uri.startsWith(this.uri)
    }

    getParsedFileByUri(uri: string) {
        return this.parsedFiles.find(file => file.uri === uri)
    }

    getNodesByType<T extends abstract new (...args: any) => any>(type: T): Array<{ uri: string, nodes: LinePositionedNode<InstanceType<T>>[] }> {
        const nodes = []
        for (const file of this.parsedFiles) {
            const fileNodes = file.nodesByType.get(type)
            if (fileNodes) {
                nodes.push({
                    uri: file.uri,
                    nodes: fileNodes
                })
            }
        }
        return nodes
    }

    protected clear() {
        this.parsedFiles = []
        this.filesWithErrors = []
    }
}