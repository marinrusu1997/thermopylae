const eslint = require('@thermopylae/dev.environment').configs.eslint;
eslint.rules["import/no-unresolved"][1].ignore.push(
    './index',
    './interface',
    './basic-types',
    './enums',
    './models',
    './sessions',
    './types/repositories',
    '../types/repositories',
    './step',
    './hooks',
    '../hooks',
    './policy',
    './hash',
    './contexts',
    './types/side-channels',
    '../typings',
    './typings'
);

module.exports = eslint;
