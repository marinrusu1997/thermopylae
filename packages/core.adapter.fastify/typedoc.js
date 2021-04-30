const typedoc = require('@thermopylae/module-builder').configs.typedoc;
typedoc.outline = [
    {
        "Request": "request",
        "Response": "response"
    }
];
typedoc.links = [{
    "label": "Bitbucket",
    "url": "https://bitbucket.org/marinrusu1997/framework/src/master/packages/core.adapter.fastify/"
}]

module.exports = typedoc;
