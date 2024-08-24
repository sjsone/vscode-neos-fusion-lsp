import { ClientCapabilities, DidChangeConfigurationParams, InitializeParams } from 'vscode-languageserver'
import { LanguageServer } from '../LanguageServer'
import { ExtensionConfiguration } from '../ExtensionConfiguration'
import { Logger, LogService } from '../common/Logging'
import { clearLineDataCache } from '../common/util'

export abstract class Client extends Logger {
	public clientCapabilities!: ClientCapabilities
	protected languageServer!: LanguageServer

	constructor() {
		super()
		this.reconfigureLogger()
	}

	onInitialize(params: InitializeParams) {
		// stub
	}

	protected reconfigureLogger() {
		// stub
	}

	setCapabilities(clientCapabilities: ClientCapabilities) {
		this.clientCapabilities = clientCapabilities
	}

	abstract getInfo(): string

	public async onDidChangeConfiguration(params: DidChangeConfigurationParams) {
		const configuration: ExtensionConfiguration = params.settings.neosFusionLsp
		return this.handleConfigurationAndInitFusionWorkspaces(configuration)
	}

	protected async handleConfigurationAndInitFusionWorkspaces(configuration: ExtensionConfiguration) {
		Object.freeze(configuration)
		this.logInfo("Configuration: " + JSON.stringify(configuration))

		await this.languageServer.sendBusyCreate('reload', {
			busy: true,
			text: "$(rocket)",
			detail: "initializing language server",
			name: "initializing",
			severity: 1 // Warning
		})

		LogService.setLogLevel(configuration.logging.level)

		for (const fusionWorkspace of this.languageServer.fusionWorkspaces) {
			await fusionWorkspace.init(configuration)
		}

		clearLineDataCache()

		await this.languageServer.sendBusyDispose('reload')
	}

	static SetLanguageServer(client: Client, languageServer: LanguageServer) {
		client.languageServer = languageServer
	}
}