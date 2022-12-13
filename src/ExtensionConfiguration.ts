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
export interface ExtensionConfiguration {
    folders: {
        packages: string[],
        fusion: string[],
        ignore: string[],
        workspaceAsPackageFallback: boolean
    },
    logging: {
        level: LoggingLevel
    },
    diagnostics: {
        // TODO: Add EEL-Helper configuration
        enabled: boolean,
        ignore: {
            folders: string[]
        }
    },
    code: {
        deprecations: {
            fusion: { [key: string]: string }
        }
    },
    inlayHint: {
        depth: InlayHintDepth
    }
}