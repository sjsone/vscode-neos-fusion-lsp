import * as NodeFs from "fs"
import * as NodePath from "path"
import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { FilePatternResolver } from 'ts-fusion-runtime/out/core/FilePatternResolver'
import { ArrayTreeRoot } from 'ts-fusion-runtime/out/core/MergedArrayTree'
import { TextDocumentChangeEvent } from 'vscode-languageserver'
import { TextDocument } from "vscode-languageserver-textdocument"
import { LoggingLevel, type ExtensionConfiguration } from '../ExtensionConfiguration'
import { LanguageServer } from '../LanguageServer'
import { CacheManager } from '../cache/CacheManager'
import { ComposerService } from '../common/ComposerService'
import { LinePositionedNode } from '../common/LinePositionedNode'
import { LogService, Logger } from '../common/Logging'
import { TranslationService } from '../common/TranslationService'
import { getFiles, pathToUri, uriToPath } from '../common/util'
import { ParsedFusionFileDiagnostics } from '../diagnostics/ParsedFusionFileDiagnostics'
import { NeosPackage } from '../neos/NeosPackage'
import { NeosWorkspace } from '../neos/NeosWorkspace'
import { XLIFFTranslationFile } from '../translations/XLIFFTranslationFile'
import { LanguageServerFusionParser } from './LanguageServerFusionParser'
import { ParsedFusionFile } from './ParsedFusionFile'
import { UserPresentableError } from '../error/UserPresentableError'
import { ControllableError } from '../error/ControllableError'
import { MessageType } from "vscode-languageserver/node"
import { ComposerJsonNotFoundError } from '../error/ComposerJsonNotFoundError'
import { NoPackagesFoundError } from '../error/NoPackagesFoundError'
import { RootComposerJsonNotFoundError } from '../error/RootComposerJsonNotFoundError'
import { RuntimeConfiguration } from 'ts-fusion-runtime'

export class FusionWorkspace extends Logger {
    public uri: string
    public name: string
    public languageServer: LanguageServer
    protected configuration!: ExtensionConfiguration
    protected parsedFusionFileDiagnostics!: ParsedFusionFileDiagnostics

    public neosWorkspace!: NeosWorkspace

    public fusionParser: LanguageServerFusionParser
    public mergedArrayTree: ArrayTreeRoot = {}
    public fusionRuntimeConfiguration: RuntimeConfiguration = new RuntimeConfiguration({})
    public fusionRuntimeConfigurationCache: { [key: string]: any } = {}
    public parsedFiles: ParsedFusionFile[] = []
    public filesWithErrors: string[] = []

    public translationFiles: XLIFFTranslationFile[] = []

    protected filesToDiagnose: ParsedFusionFile[] = []

    protected selectedFlowContextName?: string = "Development"

    constructor(name: string, uri: string, languageServer: LanguageServer) {
        super(name)
        this.name = name
        this.uri = uri
        this.languageServer = languageServer
        this.fusionParser = new LanguageServerFusionParser(this)
    }

    setSelectedFlowContextName(contextName: string) {
        this.selectedFlowContextName = contextName
        this.neosWorkspace.configurationManager.selectContextPath(contextName)
    }

    getConfiguration() {
        return this.configuration
    }

    getUri() {
        return this.uri
    }

    public async init(configuration: ExtensionConfiguration) {
        this.configuration = configuration
        this.clear()
        this.parsedFusionFileDiagnostics = new ParsedFusionFileDiagnostics(configuration.diagnostics)

        try {
            await this.initPackagesPaths()
            await this.initPackages()
            await this.initFusionFiles()
            await this.initTranslations()
        } catch (error) {
            if (!(error instanceof RootComposerJsonNotFoundError)) throw error
            this.languageServer.sendRootComposerJsonNotFound(error.getPath())
            return

        }

        const begin = process.hrtime.bigint()

        await this.languageServer.sendProgressNotificationCreate("init_diagnose_files", `diagnosing ${this.filesToDiagnose.length} files`)
        try {
            await this.processFilesToDiagnose(true)
        } catch (error) {
            this.logError("Error processing files to diagnose: ", error)
        }
        await this.languageServer.sendProgressNotificationFinish("init_diagnose_files")

        const endInMS = (process.hrtime.bigint() - begin) / 1000000n;
        this.logInfo(`Initial diagnostics took: ${endInMS}ms`)
    }

    protected async initPackagesPaths() {
        const workspacePath = uriToPath(this.uri)
        const packagesPaths = ComposerService.getComposerPackagePaths(this, this.configuration)
        this.logDebug("packagesPaths", packagesPaths)
        this.neosWorkspace = new NeosWorkspace(this, workspacePath, this.name)

        try {
            for (const packagePath of packagesPaths) {
                this.neosWorkspace.addPackage(packagePath)
            }
        } catch (error) {
            if (!(error instanceof ComposerJsonNotFoundError)) throw error
            this.logError(error.message)
        }

        this.neosWorkspace.init(this.selectedFlowContextName)
        await this.languageServer.sendFlowConfiguration(this.neosWorkspace.configurationManager['mergedConfiguration'])

        const incrementPerPackage = 100 / Array.from(packagesPaths).length
        for (const neosPackage of this.neosWorkspace.getPackages().values()) {
            const packagePath = neosPackage.path
            await this.languageServer.sendProgressNotificationUpdate("init_packages_paths", {
                message: `Package: ${packagePath}`
            }).catch(error => this.logError(`Error trying to send progress notification for package ${packagePath}`, error))

            for (const packageFusionFolderPath of this.configuration.folders.fusion) {
                const fusionFolderPath = NodePath.join(packagePath, packageFusionFolderPath)
                if (!NodeFs.existsSync(fusionFolderPath)) continue

                for (const fusionFilePath of getFiles(fusionFolderPath)) {
                    this.addParsedFileFromPath(fusionFilePath, neosPackage)
                }
            }

            await this.languageServer.sendProgressNotificationUpdate("init_packages_paths", {
                increment: incrementPerPackage
            }).catch(error => this.logError("Error trying to send progress notification update: ", error))
        }

        await this.languageServer.sendProgressNotificationFinish("init_packages_paths")
    }

    protected async initPackages() {
        const possibleNeosFusionPackages = this.orderNeosPackages(Array.from(this.neosWorkspace.getPackages().values()))

        this.logInfo("Root Fusion Paths and order for include: ")
        for (const neosPackage of possibleNeosFusionPackages) {
            this.initPackageRootFusionFiles(neosPackage)
        }

        FilePatternResolver.addUriProtocolStrategy('nodetypes:', (uri, filePattern, contextPathAndFilename) => {
            if (uri.protocol !== "nodetypes:") return undefined
            if (!contextPathAndFilename) return undefined

            const neosPackage = this.neosWorkspace.getPackage(uri.hostname)
            if (!neosPackage) return undefined

            return NodePath.join(neosPackage["path"], "NodeTypes", uri.pathname)
        })
    }

    public initPackageRootFusionFiles(neosPackage: NeosPackage) {
        // TODO: introduce something like a "FusionRootContext" for each root file and associate ParsedFusionFiles with these "FusionRootContexts"
        const possibleFusionRootPaths = this.configuration.folders.fusion.map(path => NodePath.join(path, "Root.fusion"))

        const existingFusionRootPaths = possibleFusionRootPaths.map(path => NodePath.join(neosPackage.path, path)).filter(path => NodeFs.existsSync(path))

        const alreadyHadFoundFusionRootPaths = (this.fusionParser.rootFusionPaths.get(neosPackage) ?? []).length > 0
        const fusionRootPathsExist = existingFusionRootPaths.length > 0

        if (fusionRootPathsExist || alreadyHadFoundFusionRootPaths) {
            this.fusionParser.rootFusionPaths.set(neosPackage, existingFusionRootPaths)
            const rootPaths = existingFusionRootPaths.map(p => p.split("/").slice(-2).join('/'))
            this.logInfo(`    ${neosPackage.getName()}[${neosPackage["composerJson"]["type"]}]: `, rootPaths)
        }
    }

    protected async initFusionFiles() {
        await this.languageServer.sendProgressNotificationCreate("init_fusion_files_buildMergedArrayTree", "Building MergedArrayTree")
        this.buildMergedArrayTree()
        await this.languageServer.sendProgressNotificationFinish("init_fusion_files_buildMergedArrayTree")

        await this.languageServer.sendProgressNotificationCreate("init_fusion_files_post_processing", "Post processing fusion files")
        const increment = 100 / this.parsedFiles.length
        for (const parsedFile of this.parsedFiles) {
            parsedFile.runPostProcessing()
            await this.languageServer.sendProgressNotificationUpdate("init_fusion_files_post_processing", { increment })

        }
        await this.languageServer.sendProgressNotificationFinish("init_fusion_files_post_processing")

        this.logInfo(`Successfully parsed ${this.parsedFiles.length} fusion files. `)

        // TODO: TBD-setting "workspace root" to allow for things like `my-project/source/<Packages>` instead of `my-project/<Packages>`

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
    }

    protected async initTranslations() {
        await this.languageServer.sendProgressNotificationCreate("init_translations", "initializing translations")
        const packages = Array.from(this.neosWorkspace.getPackages().values())
        const increment = 100 / packages.length
        for (const neosPackage of packages) {
            const translations = await TranslationService.readTranslationsFromPackage(neosPackage)
            this.translationFiles.push(...translations)
            await this.languageServer.sendProgressNotificationUpdate("init_translations", { increment })
        }
        await this.languageServer.sendProgressNotificationFinish("init_translations")
    }

    protected orderNeosPackages(packages: NeosPackage[]) {
        // TODO: use correct package include order instead of guessing

        const sortOrderType = ["neos-framework", "neos-package", "neos-site", "library"]
        return packages.sort((a, b) => {
            const pathAIndex = a["path"].includes("DistributionPackages") ? 1 : 0
            const pathBIndex = b["path"].includes("DistributionPackages") ? 1 : 0
            if (pathAIndex !== pathBIndex) return pathAIndex - pathBIndex

            return sortOrderType.indexOf(a["composerJson"]["type"]) - sortOrderType.indexOf(b["composerJson"]["type"])
        })
    }

    buildMergedArrayTree(reason: string | undefined = undefined) {
        // if (reason) console.log("buildMergedArrayTree because", reason)
        const startTimeFullMergedArrayTree = performance.now()
        this.languageServer.sendBusyCreate('parsingFusionMergedArrayTree', {
            busy: true,
        })

        this.mergedArrayTree = this.fusionParser.parseRootFusionFiles()
        this.fusionRuntimeConfiguration = new RuntimeConfiguration(this.mergedArrayTree)
        this.fusionRuntimeConfigurationCache = {}
        this.logDebug("Cleared 'fusionRuntimeConfigurationCache'")
        // console.log("buildMergedArrayTree component @context", this.mergedArrayTree["__prototypes"]?.["Neos.Fusion:Component"]?.["__meta"]?.["context"])
        this.logVerbose(`Elapsed time FULL MAT: ${performance.now() - startTimeFullMergedArrayTree} milliseconds`)
        this.languageServer.sendBusyDispose('parsingFusionMergedArrayTree')
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

    protected isFileInIgnoredDiagnosticsFolder(parsedFile: ParsedFusionFile): boolean {
        const filePath = uriToPath(parsedFile.uri)
        const workspacePath = NodePath.resolve(uriToPath(this.uri), this.configuration.folders.root)
        const foundIgnoredFolder = this.configuration.diagnostics.ignore.folders.find(path => {
            const ignoredFolderPath = NodePath.resolve(workspacePath, path)
            return filePath.startsWith(ignoredFolderPath)
        })
        return foundIgnoredFolder !== undefined
    }

    initParsedFile(parsedFile: ParsedFusionFile, text?: string) {
        if (this.filesWithErrors.includes(parsedFile.uri)) return false

        try {
            parsedFile.clear()
            if (!parsedFile.init(text)) {
                this.filesWithErrors.push(parsedFile.uri)
                return false
            }

            const ignoreDiagnosticsForFile = this.isFileInIgnoredDiagnosticsFolder(parsedFile)
            if (this.configuration.diagnostics.enabled && !ignoreDiagnosticsForFile) {
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
        this.buildMergedArrayTree("updateFileByChange")
        file.runPostProcessing()

        if (this.configuration.diagnostics.alwaysDiagnoseChangedFile && !this.filesToDiagnose.includes(file)) {
            this.filesToDiagnose.push(file)
        }

        // TODO: get Root.fusion file of changed file
        CacheManager.clearByFusionFileUri(file.uri)

        await this.processFilesToDiagnose()
    }

    isResponsibleForUri(uri: string) {
        return uri.startsWith(this.uri)
    }

    getParsedFileByUri(uri: string) {
        return this.parsedFiles.find(file => file.uri === uri)
    }

    getParsedFileByContextPathAndFilename(contextPathAndFilename: string) {
        return this.parsedFiles.find(file => file.uri.endsWith(contextPathAndFilename))
    }

    getNodesByType<T extends new (...args: any[]) => AbstractNode>(type: T) {
        const nodes: { uri: string, nodes: LinePositionedNode<InstanceType<T>>[] }[] = []
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
            return !this.isFileInIgnoredDiagnosticsFolder(parsedFile)
        })
        return this.processFilesToDiagnose()
    }

    protected async processFilesToDiagnose(timeEachFileDiagnostic: boolean = false) {
        const randomDiagnoseRun = Math.round(Math.random() * 100)
        this.logDebug(`<${randomDiagnoseRun}> Will diagnose ${this.filesToDiagnose.length} files`)
        this.languageServer.sendBusyCreate('diagnostics')

        for (const parsedFile of this.filesToDiagnose) {
            // const begin = process.hrtime.bigint()
            const diagnostics = await this.parsedFusionFileDiagnostics.diagnose(parsedFile)
            // const end = process.hrtime.bigint() - begin
            if (diagnostics) await this.languageServer.sendDiagnostics({
                uri: parsedFile.uri,
                diagnostics
            })
            // const endAsMicroseconds = end / 1000n
            // if (endAsMicroseconds > 1000) this.logInfo(`Diagnose took ${endAsMicroseconds} microseconds: ${parsedFile.uri}`)
        }

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