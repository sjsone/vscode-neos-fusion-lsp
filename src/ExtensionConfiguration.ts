export enum LoggingLevel {
    Info = "info",
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
        projectConfiguration: string,
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
        }
    },
    code: {
        deprecations: {
            fusion: {
                prototypes: { [key: string]: (string | DeprecationConfigurationSpecialType) }
            }
        }
    },
    inlayHint: {
        depth: InlayHintDepth
    }
}