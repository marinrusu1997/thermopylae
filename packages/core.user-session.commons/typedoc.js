const typedoc = require('@thermopylae/module-builder').configs.typedoc;
typedoc.externalPattern = [
    'lib/storage/serializers/**/*.ts'
];
typedoc.outline = [
    {
        "Storage": "storage",
        "Typings": "typings"
    }
];
typedoc.links = [{
    "label": "Bitbucket",
    "url": "https://bitbucket.org/marinrusu1997/framework/src/master/packages/core.user-session.commons/"
}]

module.exports = typedoc;
