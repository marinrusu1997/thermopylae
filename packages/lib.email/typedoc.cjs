const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.outline = [
    {
        "Client": "client",
        "Hooks": "hooks",
        "Typings": "types"
    }
];

typedoc.links = [
    {
        "label": "Thermopylae",
        "url": "https://marinrusu1997.github.io/thermopylae"
    },
    {
        "label": "Github",
        "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/lib.email"
    }
];

module.exports = typedoc;
