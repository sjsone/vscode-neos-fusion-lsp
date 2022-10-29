export enum LoggingLevel {
    Info = "info",
    Verbose = "verbose",
    Debug = "debug"
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
        enabled: boolean,
        ignore: {
            folders: string[]
        }
    }
}