import * as NodeFs from "fs"
import * as NodePath from "path"
import { parse as parseYaml } from 'yaml'
import { getFiles, mergeObjects } from '../util';

export type ParsedYaml = string | null | number | {[key: string]: ParsedYaml}

export class FlowConfiguration {
	protected parsedYamlConfiguration: ParsedYaml

	constructor(parsedYamlConfiguration: ParsedYaml) {
		this.parsedYamlConfiguration = parsedYamlConfiguration
	}	

	get<T extends ParsedYaml>(path: string|string[], parsedYamlConfiguration = this.parsedYamlConfiguration): T {
		if(!Array.isArray(path)) path = path.split(".")
		const key = path.shift()
		const value = parsedYamlConfiguration[key]
		if(path.length === 0) return value
		if(value === undefined || value === null) return undefined
		return (typeof value === 'object' && typeof value !== 'function') ? this.get(path, value) : undefined
	}
	

	static FromFolder(folderPath: string) {
		let configuration = {}
        for (const configurationFilePath of getFiles(folderPath, ".yaml")) {
            const configurationFile = NodeFs.readFileSync(configurationFilePath).toString()

            const parsedYaml = parseYaml(configurationFile)
            try {
                configuration = mergeObjects(configuration, parsedYaml)
            } catch (e) {
                if (e instanceof Error) {
                    console.log("ERROR", e.message)
                }
            }
        }
        return new FlowConfiguration(configuration)
	}
}