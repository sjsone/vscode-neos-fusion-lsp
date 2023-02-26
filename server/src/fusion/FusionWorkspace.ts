import * as NodeFs from "fs"
import * as NodePath from "path"
import { TextDocumentChangeEvent } from 'vscode-languageserver'
import { TextDocument } from "vscode-languageserver-textdocument"
import { LoggingLevel, type ExtensionConfiguration } from '../ExtensionConfiguration'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { NeosWorkspace } from '../neos/NeosWorkspace'
import { ParsedFusionFile } from './ParsedFusionFile'
import { getFiles, pathToUri, uriToPath } from '../common/util'
import { Logger, LogService } from '../common/Logging'
import { LanguageServer } from '../LanguageServer'
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { diagnose } from '../diagnostics/ParsedFusionFileDiagnostics'
import { NeosPackage } from '../neos/NeosPackage'

export class FusionWorkspace extends Logger {
    public uri: string
    public name: string
    public languageServer: LanguageServer
    protected configuration: ExtensionConfiguration

    public neosWorkspace: NeosWorkspace

    public parsedFiles: ParsedFusionFile[] = []
    public filesWithErrors: string[] = []

    protected filesToDiagnose: ParsedFusionFile[] = []

    constructor(name: string, uri: string, languageServer: LanguageServer) {
        super(name)
        this.name = name
        this.uri = uri
        this.languageServer = languageServer
    }

    getConfiguration() {
        return this.configuration
    }

    getUri() {
        return this.uri
    }

    init(configuration: ExtensionConfiguration) {
        this.configuration = configuration
        this.clear()
        this.languageServer.sendProgressNotificationCreate("fusion_workspace_init", "Fusion")
        const workspacePath = uriToPath(this.uri)

        const ignoreFolders = configuration.folders.ignore
        const packagesRootPaths = configuration.folders.packages.filter(path => NodeFs.existsSync(path))
        const filteredPackagesRootPaths = packagesRootPaths.filter(packagePath => !ignoreFolders.find(ignoreFolder => packagePath.startsWith(NodePath.join(workspacePath, ignoreFolder))))

        const packagesPaths = []

        for (const filteredPackagesRootPath of filteredPackagesRootPaths) {
            for (const folder of NodeFs.readdirSync(filteredPackagesRootPath, { withFileTypes: true })) {
                if (folder.isSymbolicLink() && !configuration.folders.followSymbolicLinks) continue
                if (!folder.isDirectory()) continue
                if (folder.name.startsWith(".") && !configuration.folders.includeHiddenDirectories) continue

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

        for (const neosPackage of this.neosWorkspace.getPackages().values()) {
            const packagePath = neosPackage["path"]
            this.languageServer.sendProgressNotificationUpdate("fusion_workspace_init", {
                message: `Package: ${packagePath}`
            })
            for (const packageFusionFolderPath of configuration.folders.fusion) {
                const fusionFolderPath = NodePath.join(packagePath, packageFusionFolderPath)
                if (!NodeFs.existsSync(fusionFolderPath)) continue

                for (const fusionFilePath of getFiles(fusionFolderPath)) {
                    this.addParsedFileFromPath(fusionFilePath, neosPackage)
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

        this.processFilesToDiagnose()
    }

    addParsedFileFromPath(fusionFilePath: string, neosPackage: NeosPackage) {
        try {
            const parsedFile = new ParsedFusionFile(pathToUri(fusionFilePath), this, neosPackage)
            this.initParsedFile(parsedFile)
            this.parsedFiles.push(parsedFile)
        } catch (e) {
            this.filesWithErrors.push(pathToUri(fusionFilePath))
        }
    }

    removeParsedFile(uri: string) {
        const parsedFileIndex = this.parsedFiles.findIndex(parsedFile => parsedFile.uri === uri)
        if (parsedFileIndex > -1) {
            this.parsedFiles.splice(parsedFileIndex, 1)
            this.logDebug(`Removed ParsedFusionFile ${uri}`)
        }
    }

    initParsedFile(parsedFile: ParsedFusionFile, text: string = undefined) {
        if (this.filesWithErrors.includes(parsedFile.uri)) return false

        try {
            parsedFile.clear()
            if (!parsedFile.init(text)) {
                this.filesWithErrors.push(parsedFile.uri)
                return false
            }

            const filePath = uriToPath(parsedFile.uri)
            const inIgnoredFolder = this.configuration.diagnostics.ignore.folders.find(path => filePath.startsWith(NodePath.resolve(uriToPath(this.uri), path)))

            if (this.configuration.diagnostics.enabled && inIgnoredFolder === undefined) {
                this.filesToDiagnose.push(parsedFile)

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
        this.initParsedFile(file, change.document.getText())

        if (this.configuration.diagnostics.alwaysDiagnoseChangedFile && !this.filesToDiagnose.includes(file)) {
            this.filesToDiagnose.push(file)
        }

        await this.processFilesToDiagnose()
    }

    isResponsibleForUri(uri: string) {
        return uri.startsWith(this.uri)
    }

    getParsedFileByUri(uri: string) {
        return this.parsedFiles.find(file => file.uri === uri)
    }

    getNodesByType<T extends new (...args: unknown[]) => AbstractNode>(type: T): Array<{ uri: string, nodes: LinePositionedNode<InstanceType<T>>[] }> {
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

    protected async processFilesToDiagnose() {
        await Promise.all(this.filesToDiagnose.map(async parsedFile => {
            const diagnostics = await diagnose(parsedFile)
            if (diagnostics) {
                this.languageServer.sendDiagnostics({
                    uri: parsedFile.uri,
                    diagnostics
                })
            }
        }))
        this.filesToDiagnose = []
    }

    protected clear() {
        this.parsedFiles = []
        this.filesWithErrors = []
    }
}