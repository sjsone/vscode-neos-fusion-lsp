import {
	Event,
	EventEmitter,
	ProviderResult,
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
		this.onDidChangeTreeDataEventEmitter.fire(undefined);
	}

	getTreeItem(element: NeosConfigurationNode): TreeItem | Thenable<TreeItem> {
		const treeItem = new TreeItem(element.path[element.path.length - 1])
		treeItem.id = element.path.join('###')

		const data = this.getDataFromPath(element.path)
		treeItem.collapsibleState = typeof data === 'object' && data !== null ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None
		treeItem.description = this.buildTreeItemDescription(data)

		return treeItem
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