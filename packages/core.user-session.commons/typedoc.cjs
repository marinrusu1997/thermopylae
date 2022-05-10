const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.externalPattern = [
    'lib/storage/serializers/**/*.ts'
];

typedoc.outline = [
    {
        "Storage": "storage",
        "Typings": "typings",
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
        "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/core.user-session.commons"
    }
];

module.exports = typedoc;
