import { FusionWorkspace } from '../fusion/FusionWorkspace';
import { LanguageServer } from '../LanguageServer';
import * as NodePath from 'path';
import { pathToUri } from '../util';
import { LoggingLevel } from '../ExtensionConfiguration';
import { ReferenceCapability } from '../capabilities/ReferenceCapability';
import { jestExpect as expect } from '@jest/expect';
import { DefinitionCapability } from '../capabilities/DefinitionCapability';

// start watcher / build
// run with: node server/out/test/setup.js
const baseUri = pathToUri(NodePath.join(__dirname, "../../fixtures/Fusion"));

let workspace: FusionWorkspace;

class FakeLanguageServer {

	sendProgressNotificationCreate(...args: any[]): void {
		// console.log(...args);
	}

	sendProgressNotificationUpdate(...args: any[]): void {
		// console.log(...args);
	}

	sendProgressNotificationFinish(...args: any[]): void {
		// console.log(...args);
	}

	sendDiagnostics(diagnostic: any): void {
		if (diagnostic.diagnostics.length === 0) {
			return;
		}

		switch (diagnostic.uri) {
			case baseUri + "/Diagnostics/Diagnostics.fusion":
				expect(diagnostic.diagnostics).toStrictEqual([
					{
						severity: 2,
						range: { start: { line: 2, character: 14 }, end: { line: 2, character: 31 } },
						message: 'Could not resolve "props.nonExistent"',
						source: 'Fusion LSP'
					}
				]);
				break;

			default:
				expect(true).toBeFalsy();
				break;
		}

	}

	getWorspaceFromFileUri(uri: string): FusionWorkspace {
		return workspace;
	}
}


const fakeLanguageServer = new FakeLanguageServer() as unknown as LanguageServer;

workspace = new FusionWorkspace(
	"test",
	pathToUri(NodePath.join(__dirname, "../../fixtures")),
	fakeLanguageServer
);

workspace.init({
	folders: {
		packages: [],
		fusion: [
			"Fusion"
		],
		ignore: [],
		workspaceAsPackageFallback: true
	},
	logging: {
		level: LoggingLevel.Debug
	},
	diagnostics: {
		enabled: true,
		ignore: {
			folders: []
		}
	}
})




const referenceCapability = new ReferenceCapability(fakeLanguageServer);

let result: any;

result = referenceCapability.execute({
	textDocument: {
		uri: baseUri + "/ReferenceCapability/ReferenceCapability.fusion"
	},
	position: {
		line: 1,
		character: 10
	}
})

expect(result).toStrictEqual([{
	uri: baseUri + "/ReferenceCapability/ReferenceCapability.fusion",
	range: {
		start: { line: 4, character: 11 },
		end: { line: 4, character: 32 }
	}
}])

result = referenceCapability.execute({
	textDocument: {
		uri: baseUri + "/ReferenceCapability/ExternalPrototype.fusion"
	},
	position: {
		line: 1,
		character: 10
	}
})

expect(result).toStrictEqual([{
	uri: baseUri + "/ReferenceCapability/ReferenceCapability.fusion",
	range: {
		start: { line: 6, character: 11 },
		end: { line: 6, character: 32 }
	}
}])


const definitionCapability = new DefinitionCapability(fakeLanguageServer);

result = definitionCapability.execute({
	textDocument: {
		uri: baseUri + "/DefinitionCapability/DefinitionCapability.fusion"
	},
	position: {
		line: 4,
		character: 22
	}
})

expect(result).toStrictEqual([{
	targetUri: baseUri + "/DefinitionCapability/DefinitionCapability.fusion",
	targetRange: {
		start: { line: 1, character: 10 },
		end: { line: 1, character: 33 }
	},
	targetSelectionRange: {
		start: { line: 1, character: 10 },
		end: { line: 1, character: 33 }
	},
	originSelectionRange: {
		start: { line: 4, character: 22 },
		end: { line: 4, character: 45 }
	}
}
])
