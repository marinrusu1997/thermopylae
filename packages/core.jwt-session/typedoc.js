const typedoc = require('@thermopylae/dev.environment').configs.typedoc;
typedoc.externalPattern = [
    'lib/error.ts',
    'lib/storages/refresh-tokens/avro-serializer.ts',
    'lib/storages/refresh-tokens/fast-json-serializer.ts',
    'lib/storages/refresh-tokens/json-serializer.ts'
];
typedoc.outline = [
    {
        "Middleware": "middleware",
        "Storages": {
            "RefreshTokensRedisStorage": "storages_refresh_tokens_storage",
            "InvalidAccessTokensMemCache": "storages_access_tokens"
        },
        "Logging": "logger",
        "Typings": "typings"
    }
];
typedoc.links = [{
    "label": "Bitbucket",
    "url": "https://bitbucket.org/marinrusu1997/framework/src/master/packages/core.jwt-session/"
}]

module.exports = typedoc;
