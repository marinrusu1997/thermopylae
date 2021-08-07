const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.outline = [
    {
        "Session": "session",
        "Storage": "storage",
        "Hooks": "hooks"
    }
];

typedoc.links = [{
    "label": "Github",
    "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/lib.user-session.commons"
}];

module.exports = typedoc;
