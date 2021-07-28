const object = require('@thermopylae/lib.utils').object;

const eslint = object.cloneDeep(require('@thermopylae/dev.environment').configs.eslint);
eslint.rules["import/no-unresolved"][1].ignore.push(
    './typings',
    '../typings',
    '@thermopylae/core.user-session.commons/dist/storage/serializers/jwt/avro',
    '@thermopylae/core.user-session.commons/dist/storage/serializers/jwt/fast-json',
    '@thermopylae/core.user-session.commons/dist/storage/serializers/jwt/json'
);

module.exports = eslint;
