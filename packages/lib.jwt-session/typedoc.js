const typedoc = require('@thermopylae/module-builder').configs.typedoc;
typedoc.externalPattern = [
    'lib/error.ts'
];
typedoc.outline = [
    {
        "Declarations": "_declarations_d_",
        "Invalidation": "_invalidation_",
        "SessionManager": "_jwt_"
    }
];
typedoc.links = [{
    "label": "Bitbucket",
    "url": "https://bitbucket.org/marinrusu1997/framework/src/master/packages/lib.jwt-session/"
}]

module.exports = typedoc;
