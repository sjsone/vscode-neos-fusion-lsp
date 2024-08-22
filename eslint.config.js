// /**@type {import('eslint').Linter.Config} */
// // eslint-disable-next-line no-undef
// module.exports = {
// 	root: true,
// 	parser: '@typescript-eslint/parser',
// 	plugins: [
// 		'@typescript-eslint',
// 	],
// 	extends: [
// 		'eslint:recommended',
// 		'plugin:@typescript-eslint/recommended',
// 	],
// 	rules: {
// 		'semi': [2, "never"],
// 		'@typescript-eslint/no-unused-vars': "off",
// 		'@typescript-eslint/no-explicit-any': "off",
// 		'@typescript-eslint/explicit-module-boundary-types': "off",
// 		'@typescript-eslint/no-non-null-assertion': "off",
// 		'@typescript-eslint/no-namespace': "off"
// 	}
// };


import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import path from 'path'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

const compat = new FlatCompat({
	baseDirectory: "./",
	recommendedConfig: js.configs.recommended,
})

export default [
	{
		files: ['**/*.ts'], // Apply to all TypeScript files
		ignores: ['node_modules/**', 'utility.js'], // Ignore common folders
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: ['./server/tsconfig.json', './client/tsconfig.json'], // Point to your tsconfig files
			},
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
		},
		rules: {
			...tsPlugin.configs.recommended.rules,
			'@typescript-eslint/explicit-function-return-type': 'off', // Customize as per your need
			'@typescript-eslint/no-explicit-any': 'warn',
			// Additional rules can be added here
		},
	},
	{
		files: ['server/**/*.ts'], // Specific rules for server files
		ignores: ['node_modules/**'], // Ignore common folders
		rules: {
			// Add server-specific rules here
			'@typescript-eslint/no-var-requires': 'off', // For example, allowing CommonJS imports in server files
		},
	},
	{
		files: ['client/**/*.ts'], // Specific rules for client files
		ignores: ['node_modules/**'], // Ignore common folders
		rules: {
			// Add client-specific rules here
			'react/prop-types': 'off', // Example: if using React without prop-types
		},
	},
	...compat.extends('eslint:recommended'),
	...compat.extends('plugin:@typescript-eslint/recommended'),
];

