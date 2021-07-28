const typedoc = require('@thermopylae/dev.environment').configs.typedoc;
typedoc.externalPattern = [
    'lib/logger.ts'
];
typedoc.outline = [
    {
        "Client": "_client_",
        "Typings": "_types_d_"
    }
];
typedoc.links = [{
    "label": "Bitbucket",
    "url": "https://bitbucket.org/marinrusu1997/framework/src/master/packages/lib.email/"
}]

module.exports = typedoc;
