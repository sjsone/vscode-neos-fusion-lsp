import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement'
import { FusionWorkspace } from '../FusionWorkspace'
import { ParsedFusionFile } from '../ParsedFusionFile'

declare module 'ts-fusion-parser/out/fusion/nodes/ObjectStatement' {
	interface ObjectStatement {
		routingControllerNode: undefined | RoutingControllerNode
	}
}

export class RoutingControllerNode extends AbstractNode {
	statement: ObjectStatement
	name: string

	constructor(statement: ObjectStatement, name: string) {
		let begin: number | undefined = undefined
		let end = 0
		for (const segment of statement.path.segments) {
			if (begin === undefined) begin = segment.position.begin
			end = segment.position.end
		}

		super({ begin: begin!, end })
		this.statement = statement
		statement.routingControllerNode = this
		this.name = name
	}

	static getClassDefinitionFromRoutingControllerNode(parsedFile: ParsedFusionFile, workspace: FusionWorkspace, node: RoutingControllerNode) {
		const incorrectFqcn = node.name.replaceAll(".", "\\")

		for (const neosPackage of workspace.neosWorkspace.getPackages().values()) {
			for (const namespaceName of neosPackage.namespaces.keys()) {
				if (!incorrectFqcn.startsWith(namespaceName)) continue

				const fqcn = incorrectFqcn.replace(namespaceName, namespaceName + "Controller\\")
				const classDefinition = neosPackage.getClassDefinitionFromFullyQualifiedClassName(fqcn)
				if (classDefinition) return classDefinition
			}
		}

		return undefined
	}
}