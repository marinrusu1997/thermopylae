const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.outline = [
    {
        "Middleware": "middleware",
        "Storage": "storage",
        "Logging": "logger",
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
        "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/core.cookie-session"
    }
];

module.exports = typedoc;
