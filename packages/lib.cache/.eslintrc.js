const object = require('@thermopylae/lib.utils').object;

const eslint = object.cloneDeep(require('@thermopylae/dev.environment').configs.eslint);
eslint.rules["import/no-unresolved"][1].ignore.push(
    '../contracts',
    './contracts',
    './commons',
    './interface',
    '../list/interface',
    './garbage-collectors/interface',
    '../../garbage-collectors/interface',
    '../../data-structures/list/interface',
    '../../../lib/garbage-collectors/interface'
);

module.exports = eslint;
