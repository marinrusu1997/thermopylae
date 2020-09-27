module.exports = {
    // Input Options
    "mode": "modules",
    "includeDeclarations": true,
    "exclude": [
        "test/**/*",
        "lib/index.ts"
    ],
    "excludeExternals": true,
    "excludeNotExported": true,
    "excludePrivate": true,
    "excludeProtected": true,
    "stripInternal": true,
    "ignoreCompilerErrors": false,

    // Output Options
    "out": "doc/html",
    "json": "doc/json/index.json",
    "readme": "README.md",
    "includeVersion": false,
    "hideGenerator": true,
    "disableSources": true,
    "theme": "./node_modules/typedoc-neo-theme/bin/default",

    // General Options
    "listInvalidSymbolLinks": true,
    "plugin": ["typedoc-neo-theme"],

    // Neo-theme Options
    "links": [{
        "label": "Bitbucket",
        "url": "https://bitbucket.org/marinrusu1997/framework/src/master/"
    }]
};
