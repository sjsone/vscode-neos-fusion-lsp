export enum LoggingLevel {
    Info = "info",
    Error = "error",
    Verbose = "verbose",
    Debug = "debug"
}

export enum InlayHintDepth {
    Disabled = "disabled",
    Literal = "literal",
    Always = "always"
}

export enum DeprecationsDiagnosticLevels {
    Hint = "hint",
    Info = "info",
    Warning = "warning",
    Error = "error",
}

export enum DeprecationConfigurationSpecialType {
    Ignore = "{ignore}"
}

export interface ExtensionConfigurationDiagnostics {
    enabled: boolean,
    enabledDiagnostics: {
        [key: string]: boolean;

        FusionProperties: boolean,
        ResourceUris: boolean,
        TagNames: boolean,
        EelHelperArguments: boolean,
        PrototypeNames: boolean,
        EmptyEel: boolean,
        ActionUri: boolean,
        NodeTypeDefinitions: boolean,
        NonParsedFusion: boolean,
        RootFusionConfiguration: boolean,
        TranslationShortHand: boolean,
        ParserError: boolean,
        AfxWithDollarEel: boolean,
        DuplicateStatements: boolean,
    },
    ignore: {
        folders: string[]
    },
    alwaysDiagnoseChangedFile: boolean,
    levels: {
        deprecations: DeprecationsDiagnosticLevels
    },
    ignoreNodeTypes: string[]
}

export interface ExtensionConfiguration {
    folders: {
        // TODO: multiple roots to support multi-workspaces 
        root: string
        packages: string[],
        fusion: string[],
        ignore: string[],
        projectConfiguration: string,
        workspaceAsPackageFallback: boolean,
        followSymbolicLinks: boolean,
        includeHiddenDirectories: boolean
    },
    logging: {
        level: LoggingLevel
    },
    diagnostics: ExtensionConfigurationDiagnostics,
    code: {
        deprecations: {
            fusion: {
                prototypes: { [key: string]: (string | DeprecationConfigurationSpecialType) }
            }
        },
        actions: {
            createNodeTypeConfiguration: {
                template: string
                detectAbstractRegEx: string
            },
        },
        fusion: {
            rootFiles: string[]
        }
    },
    inlayHint: {
        depth: InlayHintDepth
    },
    experimental: {
        fusionParserCaching: boolean
    }
}