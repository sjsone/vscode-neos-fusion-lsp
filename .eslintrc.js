/**@type {import('eslint').Linter.Config} */
// eslint-disable-next-line no-undef
module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	plugins: [
		'@typescript-eslint',
	],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
	],
	rules: {
		'semi': [2, "never"],
		'@typescript-eslint/no-unused-vars': "off",
		'@typescript-eslint/no-explicit-any': "off",
		'@typescript-eslint/explicit-module-boundary-types': "off",
		'@typescript-eslint/no-non-null-assertion': "off",
		'@typescript-eslint/no-namespace': "off"
	}
};