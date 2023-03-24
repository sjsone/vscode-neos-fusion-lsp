const NodeFs = require('fs');

function parseCommandLineArguments(config) {
	const args = process.argv.slice(2);
	const parsedArguments = {}

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		if (!Object.keys(config).includes(arg)) throw new Error(`Unknown argument provided: ${arg}`)
		if (config[arg] === Boolean) parsedArguments[arg] = true
		else if (i < args.length - 1) parsedArguments[arg] = args[i + 1]
		else throw new Error(`No Value provided for: ${arg}`)
	}

	return parsedArguments
}

function incrementPatchVersion(version, incrementMajor = 0, incrementMinor = 0, incrementPatch = 0) {
	const [major, minor, patch] = version.split('.');
	return `${Number(major) + incrementMajor}.${Number(minor) + incrementMinor}.${Number(patch) + incrementPatch}`;
}

function updatePackageVersion(packagePath, incrementMajor = 0, incrementMinor = 0, incrementPatch = 0) {
	const packageJson = require(packagePath);
	packageJson.version = incrementPatchVersion(packageJson.version, incrementMajor, incrementMinor, incrementPatch);
	NodeFs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 4) + '\n');
}

function buildIncrementsFromCommandLineArguments(commandLineArguments) {
	if (commandLineArguments['--pre'] === true) return { major: 0, minor: 0, patch: 2 }
	return {
		major: commandLineArguments['--major'] === true ? 1 : 0, minor: commandLineArguments['--minor'] === true ? 1 : 0, patch: commandLineArguments['--patch'] === true ? 1 : 0
	}
}

const commandLineArguments = parseCommandLineArguments({
	'--pre': Boolean,
	'--patch': Boolean,
	'--minor': Boolean,
	'--major': Boolean
})

const increments = buildIncrementsFromCommandLineArguments(commandLineArguments)
for (const path of ['./package.json', './server/package.json', './client/package.json']) {
	updatePackageVersion(path, increments.major, increments.minor, increments.patch);
}