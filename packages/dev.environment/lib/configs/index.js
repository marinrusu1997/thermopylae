const eslint = require('./eslint');
const mocha = require('./mocha');
const nyc = require('./c8.js');
const prettier = require('./prettier');
const typedoc = require('./typedoc');

module.exports = {
    eslint,
    mocha,
    nyc,
    prettier,
    typedoc
};
