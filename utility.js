const NodeFs = require('fs')

function parseCommandLineArguments(config) {
	const args = process.argv.slice(2)
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
	const [major, minor, patch] = version.split('.')
	const majorVersion = Number(major) + incrementMajor
	const minorVersion = incrementMajor > 0 ? 0 : Number(minor) + incrementMinor
	const patchVersion = incrementMajor > 0 || incrementMinor > 0 ? 0 : Number(patch) + incrementPatch

	return `${majorVersion}.${minorVersion}.${patchVersion}`
}

function updatePackageVersion(packagePath, commandLineArguments) {
	const packageJson = require(packagePath)

	const increments = buildIncrementsFromCommandLineArguments(commandLineArguments, packageJson.version)

	packageJson.version = incrementPatchVersion(packageJson.version, increments.major, increments.minor, increments.patch)
	NodeFs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 4) + '\n')
	return packageJson.version
}

function buildIncrementsFromCommandLineArguments(commandLineArguments, version) {
	const [_currentMajor, _currentMinor, currentPatch] = version.split('.')
	const isNormalRelease = Number(currentPatch) % 2 === 0
	if (commandLineArguments['--pre'] === true) return { major: 0, minor: 0, patch: isNormalRelease ? 1 : 2 }
	if (commandLineArguments['--patch'] === true) return { major: 0, minor: 0, patch: isNormalRelease ? 2 : 1 }
	return {
		major: commandLineArguments['--major'] === true ? 1 : 0, minor: commandLineArguments['--minor'] === true ? 1 : 0, patch: 0
	}
}

const commandLineArguments = parseCommandLineArguments({
	'--current': Boolean,
	'--pre': Boolean,
	'--patch': Boolean,
	'--minor': Boolean,
	'--major': Boolean
})

const packagePaths = ['./package.json', './server/package.json', './client/package.json']
if (commandLineArguments["--current"] === true) {
	const packageData = JSON.parse(NodeFs.readFileSync(packagePaths[0]).toString())
	console.log(packageData.version)
	process.exit()

} else {
	const versions = []
	for (const path of packagePaths) {
		versions.push(updatePackageVersion(path, commandLineArguments))
	}
	if (versions[0]) console.log(versions[0])
}
