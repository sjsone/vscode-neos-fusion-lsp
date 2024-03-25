import { type LanguageServer } from './LanguageServer';
import { Logger } from './common/Logging'
import { SemanticTokenService } from './common/SemanticTokenService';
import { ElementContext } from './elements/ElementContext';
import { ElementHelper } from './elements/ElementHelper';
import { ElementContextParams, ElementInterface, ElementMethod } from './elements/ElementInterface';

export class ElementService extends Logger {
	protected elements: Set<ElementInterface> = new Set()

	constructor(protected languageServer: LanguageServer) {
		super()
	}

	public addElement(element: new (...args: any[]) => ElementInterface) {
		this.elements.add(new element())
	}

	public async runElements(method: ElementMethod, params: ElementContextParams): Promise<any> {
		const results: any[] = []

		try {
			const context = ElementContext.createFromParams(this.languageServer, params)
			if (!context) return null

			const node = "foundNodeByLine" in context ? context.foundNodeByLine?.getNode() : undefined

			for (const element of this.elements) {
				if (!(method in element)) continue
				if (node && !element.isResponsible(method, node)) continue

				const result = await element[method]!(<any>context)
				if (ElementHelper.returnOnFirstResult(method)) return result

				if (Array.isArray(result)) results.push(...result)
				else if (result) results.push(result)
			}
		} catch (error) {
			this.logError(`Error trying to run element ${method}`, error)
		}

		if (method === "onSemanticTokens") {
			return SemanticTokenService.generateTokenArray(results)
		}

		return results
	}
}
