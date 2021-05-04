const object = require('@thermopylae/lib.utils').object;

const eslint = object.cloneDeep(require('@thermopylae/module-builder').configs.eslint);
eslint.rules["import/no-unresolved"][1].ignore.push(
    './aliases',
    './enums',
    './functional',
    './functions',
    './http',
    './mapped',
    './utils',
    './device',
    './location',
    './request',
    './request-headers',
    './response',
    './response-headers',
    './status-codes',
    './mime',
    './verb'
);

module.exports = eslint;
