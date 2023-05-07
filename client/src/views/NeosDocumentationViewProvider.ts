import { window as Window, CancellationToken, OutputChannel, ViewBadge, WebviewView, WebviewViewProvider, WebviewViewResolveContext } from 'vscode';

export class NeosDocumentationViewProvider implements WebviewViewProvider {
	protected currentView?: WebviewView

	constructor(protected outputChannel: OutputChannel) {

	}

	showCurrentView() {
		this.currentView?.show()
	}

	async resolveWebviewView(webviewView: WebviewView, context: WebviewViewResolveContext, token: CancellationToken) {
		// this.outputChannel.appendLine("test: " + JSON.stringify(context))
		this.currentView = webviewView

		webviewView.webview.options = {
			enableScripts: true
		}

		const neosVersion = 8.3
		webviewView.badge = {
			tooltip: `Showing documentation for NEOS ${neosVersion}`,
			value: neosVersion
		} as ViewBadge

		webviewView.title = `NEOS ${neosVersion} Docs`

		webviewView.webview.html = `
			<!doctype>
			<html>
				<div>test</div>
			</html>
		`
	}
}