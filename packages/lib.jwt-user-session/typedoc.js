const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.outline = [
    {
        "Declarations": "declarations",
        "Invalidation": "invalidation",
        "SessionManager": "manager",
        "Cache": "cache",
        "Error": "error"
    }
];

typedoc.links = [
    {
        "label": "Thermopylae",
        "url": "https://marinrusu1997.github.io/thermopylae"
    },
    {
        "label": "Github",
        "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/lib.jwt-user-session"
    }
];

module.exports = typedoc;
