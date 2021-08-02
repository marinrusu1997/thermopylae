const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.outline = [
    {
        "Client": "client",
        "Error": "error"
    }
];

typedoc.links = [{
    "label": "Github",
    "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/lib.sms"
}];

module.exports = typedoc;
