import { AbstractNode } from 'ts-fusion-parser/out/common/AbstractNode'
import { FusionObjectValue } from 'ts-fusion-parser/out/fusion/nodes/FusionObjectValue'
import { PrototypePathSegment } from 'ts-fusion-parser/out/fusion/nodes/PrototypePathSegment'
import { AbstractCapability } from './AbstractCapability'
import { ParsedFileCapabilityContext } from './CapabilityContext'

export class RenamePrepareCapability extends AbstractCapability {
	protected run<N extends AbstractNode>(capabilityContext: ParsedFileCapabilityContext<N>) {
		const node = capabilityContext.foundNodeByLine?.getNode()
		if (!node) return undefined

		if (!RenamePrepareCapability.canNodeBeRenamed(node)) {
			this.logInfo(`Node of type "${node.constructor.name}" cannot be renamed`)
			return undefined
		}

		return capabilityContext.foundNodeByLine?.getPositionAsRange()
	}

	static canNodeBeRenamed(node: AbstractNode): boolean {
		if (node instanceof PrototypePathSegment) return true
		if (node instanceof FusionObjectValue) return true
		return false
	}
}