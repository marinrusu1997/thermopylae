const typedoc = require('@thermopylae/dev.environment').configs.typedoc;
typedoc.outline = [
    {
        "Session": "session",
        "Storage": "storage",
        "Hooks": "hooks"
    }
];
typedoc.links = [{
    "label": "Bitbucket",
    "url": "https://bitbucket.org/marinrusu1997/framework/src/master/packages/lib.user-session.commons/"
}]

module.exports = typedoc;
