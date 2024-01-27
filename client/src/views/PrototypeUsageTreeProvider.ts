import {
	Event,
	EventEmitter,
	ProviderResult,
	ThemeIcon,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState
} from 'vscode'

export interface PrototypeUsageNode {
	path: string[];
}

export class PrototypeUsageTreeModel {
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

export class PrototypeUsageTreeProvider implements TreeDataProvider<PrototypeUsageNode> {
	constructor(protected prototypeUsageModel: PrototypeUsageTreeModel) {
		this.prototypeUsageModel.updated.event(() => this.refresh())
	}

	private onDidChangeTreeDataEventEmitter: EventEmitter<undefined> = new EventEmitter<undefined>()
	readonly onDidChangeTreeData: Event<void | PrototypeUsageNode | PrototypeUsageNode[]> = this.onDidChangeTreeDataEventEmitter.event

	public refresh(): any {
		this.log("Refreshing...")
		this.onDidChangeTreeDataEventEmitter.fire(undefined)
	}

	getTreeItem(element: PrototypeUsageNode): TreeItem | Thenable<TreeItem> {
		const treeItem = new TreeItem(element.path[element.path.length - 1])
		treeItem.id = element.path.join('###')

		const data = this.getDataFromPath(element.path)
		const isObject = typeof data === 'object' && data !== null

		treeItem.collapsibleState = isObject && Object.keys(data).length > 0 ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None
		treeItem.iconPath = new ThemeIcon("symbol-module")
		treeItem.description = "asdf"

		return treeItem
	}

	protected getDataFromPath(path: string[] = []) {
		let subData = this.prototypeUsageModel.getData()
		for (const part of path) {
			subData = subData[part]
			if (subData === undefined) break
		}
		return subData
	}

	getChildren(element?: PrototypeUsageNode): ProviderResult<PrototypeUsageNode[]> {
		if (element) {
			return Object.keys(this.getDataFromPath(element.path)).map(key => ({ path: [...element.path, key] }))
		} else {
			return Object.keys(this.prototypeUsageModel.getData()).map(key => ({ path: [key] }))
		}
	}

	protected log(message?: any, ...optionalParams: any[]) {
		console.log('[PrototypeUsageTreeProvider]: ', message, ...optionalParams)
	}
}