import * as NodeFs from "fs"
import * as NodePath from "path"
import { TagNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagNode';
import { ObjectFunctionPathNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectFunctionPathNode';
import { ObjectNode } from 'ts-fusion-parser/out/dsl/eel/nodes/ObjectNode';
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue';
import { MetaPathSegment } from 'ts-fusion-parser/out/fusion/nodes/MetaPathSegment';
import { ObjectStatement } from 'ts-fusion-parser/out/fusion/nodes/ObjectStatement';
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment';
import { Diagnostic, DiagnosticSeverity, DiagnosticTag } from 'vscode-languageserver';
import { DefinitionCapability } from '../capabilities/DefinitionCapability';
import { DeprecationsDiagnosticLevels } from '../ExtensionConfiguration';
import { ParsedFusionFile } from '../fusion/ParsedFusionFile';
import { PhpClassMethodNode } from '../fusion/PhpClassMethodNode';
import { ResourceUriNode } from '../fusion/ResourceUriNode';
import { LinePositionedNode } from '../common/LinePositionedNode';
import { findParent, findUntil, isPrototypeDeprecated } from '../common/util';
import { EmptyEelNode } from 'ts-fusion-parser/out/dsl/eel/nodes/EmptyEelNode';
import { EelExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/EelExpressionValue';
import { ValueAssignment } from 'ts-fusion-parser/out/fusion/nodes/ValueAssignment';
import { ActionUriActionNode } from '../fusion/ActionUriActionNode';
import { ActionUriControllerNode } from '../fusion/ActionUriControllerNode';
import { Comment } from 'ts-fusion-parser/out/common/Comment';
import { DslExpressionValue } from 'ts-fusion-parser/out/fusion/nodes/DslExpressionValue';
import { TagAttributeNode } from 'ts-fusion-parser/out/dsl/afx/nodes/TagAttributeNode';

const source = 'Neos Fusion'

export async function diagnose(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	diagnostics.push(...diagnoseFusionProperties(parsedFusionFile))
	diagnostics.push(...diagnoseResourceUris(parsedFusionFile))
	diagnostics.push(...diagnoseTagNames(parsedFusionFile))
	diagnostics.push(...diagnoseEelHelperArguments(parsedFusionFile))
	diagnostics.push(...diagnosePrototypeNames(parsedFusionFile))
	diagnostics.push(...diagnoseEmptyEel(parsedFusionFile))
	diagnostics.push(...diagnoseActionUri(parsedFusionFile))

	return diagnostics
}


function diagnoseFusionProperties(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const positionedObjectNodes = parsedFusionFile.getNodesByType(ObjectNode)
	if (positionedObjectNodes === undefined) return diagnostics

	// TODO: Put logic of DefinitionCapability in a Provider/Service instead of using a Capability 
	const definitionCapability = new DefinitionCapability(parsedFusionFile.workspace.languageServer)

	for (const positionedObjectNode of positionedObjectNodes) {
		const node = positionedObjectNode.getNode()

		const objectStatement = findParent(node, ObjectStatement)
		if (objectStatement === undefined) continue
		if (objectStatement.path.segments[0] instanceof MetaPathSegment) continue

		const pathBegin = node.path[0]["value"]
		if (pathBegin !== "props") continue
		if (node.path.length === 1) continue
		if (node.path[1]["value"] === "content") continue

		const definition = definitionCapability.getPropertyDefinitions(this, parsedFusionFile.workspace, node.path[0].linePositionedNode)
		if (definition) continue

		const affectedNodeBySemanticComment = node["parent"] instanceof TagAttributeNode ? findParent(node, TagNode) : node
		const nodesByLine = parsedFusionFile.nodesByLine[affectedNodeBySemanticComment.linePositionedNode.getBegin().line - 1] ?? []
		const foundIgnoreComment = nodesByLine.find(nodeByLine => {
			const node = nodeByLine.getNode()
			if (!(node instanceof Comment)) return false
			return node.value.trim() === "@fusion-ignore"
		})
		if (foundIgnoreComment) continue

		const foundIgnoreBlockComment = parsedFusionFile.getNodesByType(Comment)?.find(positionedComment => {
			const commentNode = positionedComment.getNode()
			if (commentNode.value.trim() !== "@fusion-ignore-block") return false
			const commentParent = commentNode["parent"]
			return !!findUntil(node, parentNode => parentNode === commentParent)
		})
		if (foundIgnoreBlockComment) continue

		const objectStatementText = node.path.map(e => e["value"]).join(".")
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: positionedObjectNode.getPositionAsRange(),
			message: `Could not resolve "${objectStatementText}"`,
			source,
			data: {
				quickAction: 'ignorable',
				commentType: findParent(node, DslExpressionValue) ? 'afx' : 'fusion',
				affectedNodeRange: affectedNodeBySemanticComment.linePositionedNode.getPositionAsRange()
			}
		}

		diagnostics.push(diagnostic)
	}

	return diagnostics
}

function diagnoseResourceUris(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const resourceUriNodes = <LinePositionedNode<ResourceUriNode>[]>parsedFusionFile.nodesByType.get(ResourceUriNode)
	if (resourceUriNodes === undefined) return diagnostics

	for (const resourceUriNode of resourceUriNodes) {
		const node = resourceUriNode.getNode()
		const uri = parsedFusionFile.workspace.neosWorkspace.getResourceUriPath(node.getNamespace(), node.getRelativePath())
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: resourceUriNode.getPositionAsRange(),
			message: ``,
			source
		}
		if (!uri) {
			diagnostic.message = `Could not resolve package "${node.getNamespace()}"`
			diagnostics.push(diagnostic)
		} else if (!NodeFs.existsSync(uri)) {
			diagnostic.message = `Could not find file "${node.getRelativePath()}"`
			diagnostics.push(diagnostic)
		}
	}

	return diagnostics
}

function diagnoseTagNames(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const positionedTagNodes = parsedFusionFile.getNodesByType(TagNode)
	if (positionedTagNodes === undefined) return diagnostics

	for (const positionedTagNode of positionedTagNodes) {
		const node = positionedTagNode.getNode()
		if (!node["selfClosing"]) continue
		if (node["end"]["name"] === "/>") continue
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: positionedTagNode.getPositionAsRange(),
			message: `Tags have to be closed`,
			source
		}
		diagnostics.push(diagnostic)
	}
	return diagnostics
}

function diagnoseEelHelperArguments(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []
	const positionedNodes = parsedFusionFile.getNodesByType(PhpClassMethodNode)
	if (!positionedNodes) return diagnostics
	for (const positionedNode of positionedNodes) {
		const node = positionedNode.getNode()
		const pathNode = node.pathNode
		if (!(pathNode instanceof ObjectFunctionPathNode)) continue

		for (const eelHelper of parsedFusionFile.workspace.neosWorkspace.getEelHelperTokens()) {
			if (eelHelper.name !== node.eelHelper.identifier) continue
			const method = eelHelper.methods.find(method => method.valid(node.identifier))
			if (!method) continue

			for (const parameterIndex in method.parameters) {
				const parameter = method.parameters[parameterIndex]
				if (parameter.defaultValue !== undefined) break
				if (pathNode.args[parameterIndex] === undefined) {
					const diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Error,
						range: positionedNode.getPositionAsRange(),
						message: `Missing argument`,
						source
					}
					diagnostics.push(diagnostic)
				}
			}

			if (pathNode.args.length > method.parameters.length) {
				for (const exceedingArgument of pathNode.args.slice(method.parameters.length)) {
					const diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Warning,
						range: exceedingArgument.linePositionedNode.getPositionAsRange(),
						message: `Too many arguments provided`,
						source
					}
					diagnostics.push(diagnostic)
				}
			}
		}
	}

	return diagnostics
}

function getDeprecationsDiagnosticsLevel(parsedFusionFile: ParsedFusionFile): DiagnosticSeverity {
	const severityConfiguration = parsedFusionFile.workspace.getConfiguration().diagnostics.levels.deprecations

	if (severityConfiguration === DeprecationsDiagnosticLevels.Info) return DiagnosticSeverity.Information
	if (severityConfiguration === DeprecationsDiagnosticLevels.Warning) return DiagnosticSeverity.Warning
	if (severityConfiguration === DeprecationsDiagnosticLevels.Error) return DiagnosticSeverity.Error

	return DiagnosticSeverity.Hint
}

function diagnosePrototypeNames(parsedFusionFile: ParsedFusionFile) {
	// TODO: Create separate Diagnostics (like capabilities)

	const diagnostics: Diagnostic[] = []

	const severity = getDeprecationsDiagnosticsLevel(parsedFusionFile)

	const pathSegments = parsedFusionFile.getNodesByType(PrototypePathSegment)
	if (pathSegments !== undefined) {
		for (const positionedPathSegment of pathSegments) {
			const node = positionedPathSegment.getNode()
			const range = positionedPathSegment.getPositionAsRange()

			if (!node.identifier.includes(":")) {
				diagnostics.push({
					severity,
					range,
					tags: [DiagnosticTag.Deprecated],
					message: `A prototype without a namespace is deprecated`,
					source
				})
			}

			if (isPrototypeDeprecated(parsedFusionFile.workspace, node.identifier)) {
				diagnostics.push({
					severity,
					range,
					tags: [DiagnosticTag.Deprecated],
					message: `Prototype ${node.identifier} is deprecated`,
					source
				})
			}
		}
	}

	const fusionObjectValues = parsedFusionFile.getNodesByType(FusionObjectValue)
	if (fusionObjectValues !== undefined) {
		for (const fusionObjectValue of fusionObjectValues) {
			const node = fusionObjectValue.getNode()
			const range = fusionObjectValue.getPositionAsRange()

			if (!node.value.includes(":")) {
				diagnostics.push({
					severity,
					range,
					message: `Using a prototype without a namespace should be avoided`,
					source
				})
			}

			const deprecated = isPrototypeDeprecated(parsedFusionFile.workspace, node.value)
			if (deprecated !== false) {
				diagnostics.push({
					severity,
					range,
					tags: [DiagnosticTag.Deprecated],
					message: `Prototype ${node.value} is deprecated.${deprecated !== true ? ` Use ${deprecated} instead.` : ''}`,
					source,
					data: {
						deprecatedName: node.value,
						newName: deprecated
					}
				})
			}
		}
	}

	return diagnostics
}

function diagnoseEmptyEel(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const eelExpressions = parsedFusionFile.getNodesByType(EelExpressionValue)
	if (!eelExpressions) return diagnostics

	const severity = getDeprecationsDiagnosticsLevel(parsedFusionFile)

	for (const eelExpression of eelExpressions) {
		const emptyEelNode = eelExpression.getNode().nodes
		if (!(emptyEelNode instanceof EmptyEelNode)) continue

		const valueAssignment = findParent(emptyEelNode, ValueAssignment)
		if (!valueAssignment) continue

		diagnostics.push({
			severity,
			range: valueAssignment.linePositionedNode.getPositionAsRange(),
			tags: [DiagnosticTag.Deprecated],
			message: `Use \`null\` instead of \`\${}\``,
			source,
			data: {
				deprecatedName: "${}",
				newName: " null"
			}
		})
	}

	return diagnostics
}

function diagnoseActionUri(parsedFusionFile: ParsedFusionFile) {
	const diagnostics: Diagnostic[] = []

	const severity = DiagnosticSeverity.Warning

	const actionUriActionNodes = parsedFusionFile.getNodesByType(ActionUriActionNode) ?? []
	for (const actionUriActionNode of actionUriActionNodes) {
		const actionNameNode = actionUriActionNode.getNode().name
		const actionName = actionNameNode.value

		if (actionName.endsWith("Action")) {
			diagnostics.push({
				severity,
				range: actionNameNode.linePositionedNode.getPositionAsRange(),
				message: `Neos would interpret this as "${actionName}Action". Remove "Action" from the name.`,
				source
			})
		}
	}

	const actionUriControllerNodes = parsedFusionFile.getNodesByType(ActionUriControllerNode) ?? []
	for (const actionUriControllerNode of actionUriControllerNodes) {
		const actionNameNode = actionUriControllerNode.getNode().name
		const actionName = actionNameNode.value

		if (actionName.endsWith("Controller")) {
			diagnostics.push({
				severity,
				range: actionNameNode.linePositionedNode.getPositionAsRange(),
				message: `Neos would interpret this as "${actionName}Controller". Remove "Controller" from the name.`,
				source
			})
		}
	}

	return diagnostics
}