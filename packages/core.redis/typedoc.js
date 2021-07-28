const typedoc = require('@thermopylae/dev.environment').configs.typedoc;
typedoc.externalPattern = [
    'lib/error.ts'
];
typedoc.outline = [
    {
        "RedisClient": "client",
        "Logging": "logger"
    }
];
typedoc.links = [{
    "label": "Bitbucket",
    "url": "https://bitbucket.org/marinrusu1997/framework/src/master/packages/core.redis/"
}]

module.exports = typedoc;
