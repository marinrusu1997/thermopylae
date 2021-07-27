const typedoc = require('@thermopylae/module-builder').configs.typedoc;
typedoc.externalPattern = [
    'lib/exception.ts'
];
typedoc.links = [{
    "label": "Github",
    "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/lib.utils"
}];

module.exports = typedoc;
