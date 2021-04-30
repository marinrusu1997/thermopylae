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
    './request-headers',
    './response-headers',
    './status-codes',
    './abstractions',
    './mime'
);

module.exports = eslint;
