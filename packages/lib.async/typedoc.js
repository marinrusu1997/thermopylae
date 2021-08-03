const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.exclude.push('lib/concurrency/index.ts');

typedoc.outline = [
    {
        "Error": "error",
        "Concurrency": {
            "Labeled Conditional Variable Manager": "concurrency_labeled_conditional_variable_manager",
            "Promise Executor": "concurrency_promise_executor",
            "Utils": "concurrency_utils"
        }
    }
];

typedoc.links = [{
    "label": "Github",
    "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/lib.async"
}];

module.exports = typedoc;
