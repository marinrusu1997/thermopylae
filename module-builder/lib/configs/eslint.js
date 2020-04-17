module.exports = {
	"root": true,
	"env": {
		"es6": true,
		"node": true
	},
	"extends": [
		"airbnb-base",

		"eslint:recommended",

		"plugin:node/recommended",
		"plugin:mocha/recommended",
		"plugin:security/recommended",

		"plugin:@typescript-eslint/recommended",
		"plugin:prettier/recommended",

		"prettier/@typescript-eslint"
	],
	"parser": "@typescript-eslint/parser",
	"parserOptions": {
		"ecmaVersion": 2020,
		"sourceType": "module",
		"project": "./tsconfig.json"
	},
	"plugins": [
		"@typescript-eslint",
		"mocha",
		"security"
	],
	"rules": {
		"prettier/prettier": "error",

		"lines-between-class-members": "warn",
		"class-methods-use-this": "warn",

		"no-console": "error",
		"no-param-reassign": "warn",
		"no-use-before-define": "warn",
		"no-await-in-loop": "warn",
		"no-plusplus": ["error", { "allowForLoopAfterthoughts": true }],

		"import/prefer-default-export": "warn",
		"import/no-extraneous-dependencies": "warn",

		"@typescript-eslint/ban-ts-ignore": "warn",
		"@typescript-eslint/no-use-before-define": "warn",
		"@typescript-eslint/no-namespace": "warn",

		"node/no-unsupported-features/es-syntax": "warn",
		"node/no-missing-import": "off",
		"node/no-extraneous-import": "error",

		"import/extensions": [
			"error",
			"ignorePackages",
			{
				"js": "never",
				"ts": "never",
				".d.ts": "never"
			}
		]
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
