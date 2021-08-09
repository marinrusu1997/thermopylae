const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.outline = [
    {
        "Middleware": "middleware",
        "Storage": "storage",
        "Logging": "logger",
        "Error": "error"
    }
];

typedoc.links = [{
    "label": "Github",
    "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/core.cookie-session"
}];

module.exports = typedoc;
