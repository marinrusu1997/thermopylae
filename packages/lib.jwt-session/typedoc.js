const typedoc = require('@thermopylae/module-builder').configs.typedoc;
typedoc.externalPattern = [
    'lib/error.ts'
];
typedoc.outline = [
    {
        "Declarations": "declarations",
        "Invalidation": "invalidation",
        "SessionManager": "jwt",
        "Logging": "logger"
    }
];
typedoc.links = [{
    "label": "Bitbucket",
    "url": "https://bitbucket.org/marinrusu1997/framework/src/master/packages/lib.jwt-session/"
}]

module.exports = typedoc;
