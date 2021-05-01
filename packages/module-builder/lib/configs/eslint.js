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

		"no-console": "error",
		"no-param-reassign": "off",
		"no-use-before-define": "off",
		"no-await-in-loop": "warn",
		"no-continue": "off",
		"no-undef": "off",
		"no-case-declarations": "error",
		"no-cond-assign": "warn",
		"no-restricted-syntax": "off",
		"no-bitwise": "warn",
		"no-plusplus": ["warn", { "allowForLoopAfterthoughts": true }],
		// base rule can report incorrect errors for TS code
		"no-shadow": "off",
		"no-nested-ternary": "warn",

		"import/no-unresolved": [
			"error",
			{
				"commonjs": true,
				"ignore": [
					'^@thermopylae/core\.declarations$'
				]
			}
		],
		"import/named": "error",
		"import/namespace": "error",
		"import/no-absolute-path": "error",
		"import/no-dynamic-require": "error",
		"import/no-extraneous-dependencies": "error",
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

		"@typescript-eslint/ban-ts-comment": "off",
		"@typescript-eslint/no-explicit-any": "warn",
		"@typescript-eslint/no-use-before-define": "off",
		"@typescript-eslint/no-namespace": "warn",
		"@typescript-eslint/no-shadow": "error",

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
		"SharedArrayBuffer": "readonly"
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
		"import/no-extraneous-dependencies": {
			"devDependencies": ["**/*.spec.ts"]
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
