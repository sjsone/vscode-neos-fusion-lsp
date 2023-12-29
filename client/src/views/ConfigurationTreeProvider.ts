import {
	Event,
	EventEmitter,
	ProviderResult,
	ThemeIcon,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState
} from 'vscode';

export interface NeosConfigurationNode {
	path: string[];
}

export class FlowConfigurationTreeModel {
	protected data: { [key: string]: any } = {}

	readonly updated = new EventEmitter<any>()

	public updateData(data: { [key: string]: any }) {
		this.data = data
		this.updated.fire(undefined)
	}

	getData() {
		return this.data ?? {}
	}
}

export class ConfigurationTreeProvider implements TreeDataProvider<NeosConfigurationNode> {
	constructor(protected flowConfigurationModel: FlowConfigurationTreeModel) {
		this.flowConfigurationModel.updated.event(() => this.refresh())
	}

	private onDidChangeTreeDataEventEmitter: EventEmitter<undefined> = new EventEmitter<undefined>();
	readonly onDidChangeTreeData: Event<void | NeosConfigurationNode | NeosConfigurationNode[]> = this.onDidChangeTreeDataEventEmitter.event;

	public refresh(): any {
		this.log("Refreshing...")
		this.onDidChangeTreeDataEventEmitter.fire(undefined);
	}

	getTreeItem(element: NeosConfigurationNode): TreeItem | Thenable<TreeItem> {
		const treeItem = new TreeItem(element.path[element.path.length - 1])
		treeItem.id = element.path.join('###')

		const data = this.getDataFromPath(element.path)
		const isObject = typeof data === 'object' && data !== null
		treeItem.collapsibleState = isObject ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None
		treeItem.iconPath = this.buildTreeItemIcon(data) ?? (isObject ? ThemeIcon.Folder : ThemeIcon.File)
		treeItem.description = this.buildTreeItemDescription(data)
		treeItem.command = this.buildTreeItemCommand(data)

		return treeItem
	}

	protected buildTreeItemIcon(data: any) {
		if (data === null) return new ThemeIcon("symbol-null")
		if (data === true || data === false) return new ThemeIcon("symbol-boolean")
		if (typeof data === "string") return new ThemeIcon("symbol-string")
		if (typeof data === "number") return new ThemeIcon("symbol-number")
		if (Array.isArray(data)) return new ThemeIcon("symbol-array")
		if (typeof data === "object") return new ThemeIcon("symbol-module")

		return undefined
	}

	protected buildTreeItemDescription(data: any) {
		if (data === null) return 'null'
		if (data === true) return 'true'
		if (data === false) return 'false'
		if (typeof data === "string") return `"${data}"`
		if (typeof data === "number") return `${data}`
		if (Array.isArray(data)) return '<Array>'

		return undefined
	}

	protected buildTreeItemCommand(data: any) {
		if (typeof data === "string" || typeof data === "number") return {
			title: "copy value",
			command: 'neos-fusion-lsp.putContentIntoClipboard',
			arguments: [
				data
			]
		}
		return undefined
	}

	protected getDataFromPath(path: string[] = []) {
		let subData = this.flowConfigurationModel.getData()
		for (const part of path) {
			subData = subData[part]
			if (subData === undefined) break
		}
		return subData
	}

	getChildren(element?: NeosConfigurationNode): ProviderResult<NeosConfigurationNode[]> {
		if (element) {
			return Object.keys(this.getDataFromPath(element.path)).map(key => ({ path: [...element.path, key] }))
		} else {
			return Object.keys(this.flowConfigurationModel.getData()).map(key => ({ path: [key] }))
		}
	}

	protected log(message?: any, ...optionalParams: any[]) {
		console.log('[ConfigurationTreeProvider]: ', message, ...optionalParams)
	}
}