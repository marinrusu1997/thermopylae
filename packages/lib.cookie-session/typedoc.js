const typedoc = require('@thermopylae/module-builder').configs.typedoc;
typedoc.externalPattern = [
    'lib/error.ts'
];
typedoc.outline = [
    {
        "SessionManager": "manager",
        "Session": "session",
        "Storage": "storage",
        "Logging": "logger"
    }
];
typedoc.links = [{
    "label": "Bitbucket",
    "url": "https://bitbucket.org/marinrusu1997/framework/src/master/packages/lib.cookie-session/"
}]

module.exports = typedoc;
