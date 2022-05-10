const eslint = require('@thermopylae/dev.environment').configs.eslint;
eslint.rules["import/no-unresolved"][1].ignore.push(
    './session',
    './storage',
    './hooks',
);

module.exports = eslint;
