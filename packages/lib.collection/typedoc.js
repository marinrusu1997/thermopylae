const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.exclude.push('lib/processor.ts');
typedoc.exclude.push('lib/retriever.ts');

typedoc.outline = [
    {
        "Collection": "collection",
        "Typings": "typings",
        "Error": "error"
    }
];

typedoc.links = [{
    "label": "Github",
    "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/lib.collection"
}];

module.exports = typedoc;
