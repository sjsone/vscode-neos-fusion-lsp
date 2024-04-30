import * as NodeFs from "fs"
import * as NodePath from "path"
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { TextDocumentChangeEvent } from 'vscode-languageserver'
import { TextDocument } from "vscode-languageserver-textdocument"
import { LoggingLevel, type ExtensionConfiguration } from '../ExtensionConfiguration'
import { LanguageServer } from '../LanguageServer'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { LogService, Logger } from '../common/Logging'
import { TranslationService } from '../common/TranslationService'
import { getFiles, pathToUri, uriToFsPath, uriToPath } from '../common/util'
import { ParsedFusionFileDiagnostics } from '../diagnostics/ParsedFusionFileDiagnostics'
import { NeosPackage } from '../neos/NeosPackage'
import { NeosWorkspace } from '../neos/NeosWorkspace'
import { XLIFFTranslationFile } from '../translations/XLIFFTranslationFile'
import { ParsedFusionFile } from './ParsedFusionFile'
import { UserPresentableError } from '../error/UserPresentableError'
import { ControllableError } from '../error/ControllableError'
import { MessageType } from "vscode-languageserver/node"
import { ComposerJsonNotFoundError } from '../error/ComposerJsonNotFoundError'
import { NoPackagesFoundError } from '../error/NoPackagesFoundError'

export class FusionWorkspace extends Logger {
    public uri: string
    public name: string
    public languageServer: LanguageServer
    protected configuration!: ExtensionConfiguration
    protected parsedFusionFileDiagnostics!: ParsedFusionFileDiagnostics

    public neosWorkspace!: NeosWorkspace

    public parsedFiles: ParsedFusionFile[] = []
    public filesWithErrors: string[] = []

    public translationFiles: XLIFFTranslationFile[] = []

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
        this.parsedFusionFileDiagnostics = new ParsedFusionFileDiagnostics(configuration.diagnostics)
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

        const usingWorkspaceAsPackageFallback = packagesPaths.length === 0 && configuration.folders.workspaceAsPackageFallback
        if (usingWorkspaceAsPackageFallback) {
            this.logDebug("fallback to using workspace as package")
            packagesPaths.push(workspacePath)
        }

        this.neosWorkspace = new NeosWorkspace(this, workspacePath, this.name)
        for (const packagePath of packagesPaths) {
            try {
                this.neosWorkspace.addPackage(packagePath)
            } catch (error) {
                this.handleError(<Error>error)
            }
        }
        this.neosWorkspace.initEelHelpers()


        const incrementPerPackage = 100 / packagesPaths.length

        for (const neosPackage of this.neosWorkspace.getPackages().values()) {
            const packagePath = neosPackage.path
            this.languageServer.sendProgressNotificationUpdate("fusion_workspace_init", {
                message: `Package: ${packagePath}`
            }).catch(error => this.logError("init", error))

            for (const packageFusionFolderPath of configuration.folders.fusion) {
                const fusionFolderPath = NodePath.join(packagePath, packageFusionFolderPath)
                if (!NodeFs.existsSync(fusionFolderPath)) continue

                for (const fusionFilePath of getFiles(fusionFolderPath)) {
                    this.addParsedFileFromPath(fusionFilePath, neosPackage)
                }
            }

            this.translationFiles.push(...TranslationService.readTranslationsFromPackage(neosPackage))

            this.languageServer.sendProgressNotificationUpdate("fusion_workspace_init", {
                increment: incrementPerPackage
            }).catch(error => this.logError("init", error))
        }

        for (const parsedFile of this.parsedFiles) {
            parsedFile.runPostProcessing()
        }

        this.logInfo(`Successfully parsed ${this.parsedFiles.length} fusion files. `)

        // TODO: TBD-setting "workspace root" to allow for things like `my-project/source/<Packages>` instead of `my-project/<Packages>`
        // TODO: if this.parsedFiles.length === 0 show error message with link to TBD-setting "workspace root"
        // TODO: if no package has a composer.json show error message with link to TBD-setting "workspace root"

        if (this.neosWorkspace.getPackages().size == 0) {
            this.handleError(new NoPackagesFoundError())
        }

        if (this.filesWithErrors.length > 0) {
            this.logInfo(`  Could not parse ${this.filesWithErrors.length} files due to errors`)

            if (LogService.isLogLevel(LoggingLevel.Verbose)) {
                this.logVerbose(`  Files:`)
                for (const fileWithError of this.filesWithErrors) {
                    this.logVerbose(`    ${fileWithError}`)
                }
            }
        }

        this.languageServer.sendProgressNotificationFinish("fusion_workspace_init").catch(error => this.logError("init", error))

        this.processFilesToDiagnose().catch(error => this.logError("init", error))
    }

    addParsedFileFromPath(fusionFilePath: string, neosPackage: NeosPackage) {
        try {
            this.logDebug("Trying to add parsed file from path", fusionFilePath, pathToUri(fusionFilePath))
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

    initParsedFile(parsedFile: ParsedFusionFile, text?: string) {
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
        } catch (error) {
            this.logError("While initializing parsed file: ", error)
            this.filesWithErrors.push(parsedFile.uri)
        }

        return false
    }

    async updateFileByChange(change: TextDocumentChangeEvent<TextDocument>) {
        const file = this.getParsedFileByUri(change.document.uri)
        if (file === undefined) return
        this.initParsedFile(file, change.document.getText())
        file.runPostProcessing()

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

    getNodesByType<T extends AbstractNode>(type: new (...args: any[]) => T): Array<{ uri: string, nodes: LinePositionedNode<T>[] }> {
        const nodes: Array<{ uri: string, nodes: LinePositionedNode<T>[] }> = []
        for (const file of this.parsedFiles) {
            const fileNodes = file.nodesByType.get(type)
            if (fileNodes) nodes.push({
                uri: file.uri,
                nodes: <any>fileNodes
            })
        }
        return nodes
    }

    getTranslationFileByUri(uri: string) {
        return this.translationFiles.find(file => file.uri === uri)
    }

    public async diagnoseAllFusionFiles() {
        this.filesToDiagnose = this.parsedFiles.filter(parsedFile => {
            const filePath = uriToPath(parsedFile.uri)
            const inIgnoredFolder = this.configuration.diagnostics.ignore.folders.find(path => filePath.startsWith(NodePath.resolve(uriToPath(this.uri), path)))
            return inIgnoredFolder === undefined
        })
        return this.processFilesToDiagnose()
    }

    protected async processFilesToDiagnose() {
        const randomDiagnoseRun = Math.round(Math.random() * 100)
        this.logDebug(`<${randomDiagnoseRun}> Will diagnose ${this.filesToDiagnose.length} files`)
        this.languageServer.sendBusyCreate('diagnostics')
        await Promise.all(this.filesToDiagnose.map(async parsedFile => {
            const diagnostics = await this.parsedFusionFileDiagnostics.diagnose(parsedFile)
            if (diagnostics) await this.languageServer.sendDiagnostics({
                uri: parsedFile.uri,
                diagnostics
            })
        }))

        this.logDebug(`<${randomDiagnoseRun}>...finished`)
        this.languageServer.sendBusyDispose('diagnostics')

        this.filesToDiagnose = []
    }

    protected clear() {
        this.parsedFiles = []
        this.filesWithErrors = []
        this.translationFiles = []
    }

    protected handleError(error: Error) {
        if (!(error instanceof ControllableError)) throw error

        this.logError(error.message)
        if (error instanceof UserPresentableError) {
            if (error instanceof ComposerJsonNotFoundError) {
                if (error.path === this.neosWorkspace["workspacePath"]) return
            }

            this.languageServer.showMessage(`${error.title} -- ${error.message}`, MessageType.Warning)
        }
    }
}