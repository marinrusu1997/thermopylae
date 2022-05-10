const path = require('path');
const fs = require('fs');

const THEME_PATH_CANDIDATES = [
    path.join(process.cwd(), "node_modules", "typedoc-neo-theme", "bin", "default"),
    path.join(process.cwd(), "..", "..", "node_modules", "typedoc-neo-theme", "bin", "default")
];
function getThemePath() {
    for (const candidate of THEME_PATH_CANDIDATES) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    throw new Error(`Can't get theme path from candidates: ${THEME_PATH_CANDIDATES.join(', ')}`);
}

module.exports = {
    // Input Options
    "entryPoints": [
        "lib/"
    ],
    "exclude": [
        "test/**/*",
        "lib/index.ts"
    ],
    "excludeExternals": true,
    "excludePrivate": true,
    "excludeProtected": true,

    // Output Options
    "out": "doc/html",
    "json": "doc/json/index.json",
    "readme": "README.md",
    "includeVersion": false,
    "hideGenerator": true,
    "disableSources": true,
    "theme": getThemePath(),

    // General Options
    "listInvalidSymbolLinks": true,
    "plugin": ["typedoc-neo-theme"]
};
