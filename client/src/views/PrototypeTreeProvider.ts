import {
	Event,
	EventEmitter,
	ProviderResult,
	ThemeIcon,
	TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	Uri
} from 'vscode'

export interface PrototypeTreeNode {
	name: string
	type: 'namespace' | 'prototype' | 'package'
	location?: { uri: string; range: any }
	prototypeType?: 'creation'
	children?: PrototypeTreeNode[]
}

export class PrototypeTreeProvider implements TreeDataProvider<PrototypeTreeNode> {
	protected onDidChangeTreeDataEventEmitter: EventEmitter<undefined | PrototypeTreeNode | PrototypeTreeNode[]> = new EventEmitter<undefined | PrototypeTreeNode | PrototypeTreeNode[]>()
	readonly onDidChangeTreeData: Event<undefined | PrototypeTreeNode | PrototypeTreeNode[]> = this.onDidChangeTreeDataEventEmitter.event

	protected prototypeData: PrototypeTreeNode[] = []
	protected client: any

	constructor(client: any) {
		this.client = client
	}

	public async refresh() {
		this.log("Refreshing prototype data...")

		try {
			await this.loadPrototypeData()
		} catch (error) {
			this.log("error", error)
		}


		this.onDidChangeTreeDataEventEmitter.fire(undefined)
	}

	protected async loadPrototypeData() {
		try {
			this.log('Sending custom/prototypes/get request...')
			this.prototypeData = await this.client.sendRequest('custom/prototypes/get')
			this.log(`Loaded ${this.countPrototypes(this.prototypeData)} prototypes`)
			if (this.prototypeData.length === 0) {
				this.prototypeData = [{
					name: 'No prototypes found',
					type: 'namespace',
					children: []
				}]
			}
		} catch (error) {
			if (error instanceof Error) {
				this.logError('Failed to load prototype data:', error)
				this.prototypeData = [{
					name: `Error: ${error.message || 'Unknown error'}`,
					type: 'namespace',
					children: []
				}]
			}

		}
	}

	protected countPrototypes(nodes: PrototypeTreeNode[]): number {
		let count = 0
		for (const node of nodes) {
			if (node.type === 'prototype') {
				count++
			}
			if (node.children) {
				count += this.countPrototypes(node.children)
			}
		}
		return count
	}

	getTreeItem(element: PrototypeTreeNode): TreeItem | Thenable<TreeItem> {
		const treeItem = new TreeItem(element.name)

		const isNamespace = element.type === 'namespace'
		const isPackage = element.type === 'package'
		if (isNamespace || isPackage) {
			treeItem.collapsibleState = element.children && element.children.length > 0
				? TreeItemCollapsibleState.Collapsed
				: TreeItemCollapsibleState.None
			treeItem.iconPath = isNamespace ? ThemeIcon.Folder : new ThemeIcon("symbol-package")

			treeItem.description = `${this.countPrototypes(element.children || [])} prototypes`
		} else {
			treeItem.collapsibleState = TreeItemCollapsibleState.None
			treeItem.iconPath = this.getPrototypeIcon(element.prototypeType)

			treeItem.command = {
				title: "Go to Prototype",
				command: 'vscode.open',
				arguments: [
					Uri.parse(element.location!.uri),
					{
						selection: element.location!.range
					}
				]
			}
		}

		return treeItem
	}

	protected getPrototypeIcon(prototypeType?: 'creation'): ThemeIcon {
		switch (prototypeType) {
			case 'creation':
				return new ThemeIcon('symbol-class')
			default:
				return new ThemeIcon('symbol-misc')
		}
	}

	getChildren(element?: PrototypeTreeNode): ProviderResult<PrototypeTreeNode[]> {
		if (!element) {
			return this.prototypeData
		}

		return element.children || []
	}

	protected log(message?: any, ...optionalParams: any[]) {
		console.log('[PrototypeTreeProvider]: ', message, ...optionalParams)
	}

	protected logError(message?: any, ...optionalParams: any[]) {
		console.error('[PrototypeTreeProvider]: ', message, ...optionalParams)
	}
}