const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.outline = [
    {
        "Client": "client",
        "Error": "error",
        "Logging": "logger",
        "Modules": {
            "JSON": "modules_json"
        }
    }
];

typedoc.links = [
    {
        "label": "Thermopylae",
        "url": "https://marinrusu1997.github.io/thermopylae"
    },
    {
        "label": "Github",
        "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/core.redis"
    }
];

module.exports = typedoc;
