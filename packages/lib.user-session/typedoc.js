const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.outline = [
    {
        "SessionManager": "manager",
        "Session": "session",
        "Storage": "storage",
        "Error": "error"
    }
];

typedoc.links = [{
    "label": "Github",
    "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/lib.user-session"
}];

module.exports = typedoc;
