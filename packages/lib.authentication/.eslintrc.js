const object = require('@thermopylae/lib.utils').object;

const eslint = object.cloneDeep(require('@thermopylae/module-builder').configs.eslint);
eslint.rules["import/no-unresolved"][1].ignore.push(
    './auth-step',
    './side-channels',
    '../side-channels',
    '../types/models',
    '../types/entities',
    '../types/schedulers',
    '../../types/requests',
    './types/requests',
    './types/basic-types',
    './types/entities',
    './types/enums',
    './types/models',
    './types/schedulers'
);

module.exports = eslint;