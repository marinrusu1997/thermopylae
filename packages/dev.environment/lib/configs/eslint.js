module.exports = {
	"root": true,
	"env": {
		"es6": true,
		"node": true
	},
	"plugins": [
		"@typescript-eslint",
		"mocha",
		"security"
	],
	"extends": [
		"airbnb-base",
		"prettier",
		"eslint:recommended",

		"plugin:node/recommended",
		"plugin:mocha/recommended",
		"plugin:security/recommended",

		"plugin:@typescript-eslint/recommended",
		"plugin:prettier/recommended"
	],
	"parser": "@typescript-eslint/parser",
	"parserOptions": {
		"ecmaVersion": 2020,
		"sourceType": "module",
		"project": "./tsconfig.json"
	},
	"rules": {
		"prettier/prettier": "error",

		"lines-between-class-members": "warn",
		"class-methods-use-this": "warn",
		"for-direction": "warn",
		"consistent-return": "warn",
		"dot-notation": "off",
		"quote-props": "off",
		"func-names": "off",

		"no-console": "error",
		"no-param-reassign": "off",
		"no-use-before-define": "off",
		"no-await-in-loop": "warn",
		"no-continue": "off",
		"no-undef": "error",
		"no-case-declarations": "error",
		"no-cond-assign": "warn",
		"no-restricted-syntax": [
			"error",
			{
				"selector": "CallExpression[callee.name='setTimeout'][arguments.length!=2]",
				"message": "setTimeout must always be invoked with two arguments."
			},
			{
				"selector": "BinaryExpression[operator='in']",
				"message": "Usage of 'in' operator is not allowed. Prefer Object.getOwnPropertyNames()."
			},
			{
				"selector": "BinaryExpression[operator=instanceof][right.name=Array]",
				"message": "`instanceof Array` is disallowed. Prefer `Array.isArray()`."
			},
			{
				"selector": "CallExpression[arguments.length=1][callee.property.name='reduce']",
				"message": "Provide initialValue to .reduce()."
			}
		],
		"no-bitwise": "warn",
		"no-plusplus": ["warn", { "allowForLoopAfterthoughts": true }],
		// base rule can report incorrect errors for TS code
		"no-shadow": "off",
		"no-nested-ternary": "warn",
		"no-underscore-dangle": ["warn", { "allow": ["__dirname", "__iter__"] }],
		"no-return-assign": ["error", "always"],
		"no-unused-vars": "off",

		"import/no-unresolved": [
			"error",
			{
				"commonjs": true,
				"ignore": [
					'^@thermopylae/lib\.user-session\.commons$'
				]
			}
		],
		"import/named": "error",
		"import/namespace": "error",
		"import/no-absolute-path": "error",
		"import/no-dynamic-require": "error",
		"import/no-extraneous-dependencies": [
			"error",
			{
				"devDependencies": ["test/**/*.ts"],
				"optionalDependencies": false,
				"bundledDependencies": false
			}
		],
		"import/prefer-default-export": "off",
		"import/extensions": [
			"error",
			{
				"js": "always",
				"json": "always",
				"ts": "never",
				".d.ts": "never"
			}
		],
		"import/no-cycle": "error",

		"@typescript-eslint/ban-ts-comment": ["error", {
			"ts-expect-error": "allow-with-description",
			"ts-ignore": "allow-with-description",
			"ts-nocheck": true,
			"ts-check": false,
			"minimumDescriptionLength": 7
		}],
		"@typescript-eslint/no-explicit-any": ["warn", {
			"ignoreRestArgs": true
		}],
		"@typescript-eslint/no-use-before-define": ["warn", { "functions": false, "classes": true, "variables": true }],
		"@typescript-eslint/no-namespace": "warn",
		"@typescript-eslint/no-shadow": "error",
		"@typescript-eslint/no-var-requires": "error",
		"@typescript-eslint/no-unused-vars": [
			"error",
			{
				"vars": "all",
				"varsIgnorePattern": "^_",
				"argsIgnorePattern": "^_",
				"destructuredArrayIgnorePattern": "^_",
				"caughtErrorsIgnorePattern": "^_",
				"args": "after-used",
				"ignoreRestSiblings": false,
				"caughtErrors": "all"
			}
		],
		"@typescript-eslint/triple-slash-reference": ["error", {
			"path": "always",
			"types": "never",
			"lib": "never"
		}],

		"node/no-unsupported-features/es-syntax": "off",
		"node/no-missing-import": "off", // never works as expected, broken rule
		"node/no-extraneous-import": "error",

		"mocha/no-setup-in-describe": "off",
		"mocha/no-exclusive-tests": "error",
		"mocha/no-pending-tests": "error",
		"mocha/no-skipped-tests": "error",

		"security/detect-object-injection": "off"
	},
	"globals": {
		"Atomics": "readonly",
		"SharedArrayBuffer": "readonly",
		"NodeJS": true
	},
	"settings": {
		"import/extensions": [
			".js",
			".ts"
		],
		"import/parsers": {
			"@typescript-eslint/parser": [
				".ts"
			]
		},
		"import/resolver": {
			"node": {
				"extensions": [
					".js",
					".ts"
				]
			}
		},

		"node": {
			"allowModules": [
				"chai",
				"mocha",
				"gulp"
			]
		}
	}
};
