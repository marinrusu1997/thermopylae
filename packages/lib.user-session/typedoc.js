const typedoc = require('@thermopylae/dev.environment').configs.typedoc;
typedoc.externalPattern = [
    'lib/error.ts'
];
typedoc.outline = [
    {
        "SessionManager": "manager",
        "Session": "session",
        "Storage": "storage"
    }
];
typedoc.links = [{
    "label": "Bitbucket",
    "url": "https://bitbucket.org/marinrusu1997/framework/src/master/packages/lib.user-session/"
}]

module.exports = typedoc;
