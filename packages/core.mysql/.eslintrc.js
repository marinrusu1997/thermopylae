const object = require('@thermopylae/lib.utils').object;

const eslint = object.cloneDeep(require('@thermopylae/dev.environment').configs.eslint);
eslint.rules["import/no-unresolved"][1].ignore.push(
    './interface',
    './connections/interface'
);

module.exports = eslint;
