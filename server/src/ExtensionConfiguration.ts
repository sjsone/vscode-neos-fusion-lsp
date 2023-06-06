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
export interface ExtensionConfiguration {
    folders: {
        packages: string[],
        fusion: string[],
        ignore: string[],
        workspaceAsPackageFallback: boolean,
        followSymbolicLinks: boolean,
        includeHiddenDirectories: boolean
    },
    logging: {
        level: LoggingLevel
    },
    diagnostics: {
        // TODO: Add EEL-Helper configuration
        enabled: boolean,
        ignore: {
            folders: string[]
        },
        alwaysDiagnoseChangedFile: boolean,
        levels: {
            deprecations: DeprecationsDiagnosticLevels
        },
        ignoreNodeTypes: string[]
    },
    code: {
        deprecations: {
            fusion: {
                prototypes: { [key: string]: (string | DeprecationConfigurationSpecialType) }
            }
        },
        actions: {
            createNodeTypeConfiguration: {
                template: string
            }
        }
    },
    inlayHint: {
        depth: InlayHintDepth
    }
}