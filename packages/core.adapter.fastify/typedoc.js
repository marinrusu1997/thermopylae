const typedoc = require('@thermopylae/dev.environment').configs.typedoc;
typedoc.outline = [
    {
        "Request": "request",
        "Response": "response"
    }
];
typedoc.links = [{
    "label": "Github",
    "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/core.adapter.fastify"
}]

module.exports = typedoc;
