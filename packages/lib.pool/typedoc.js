const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.outline = [
    {
        "Error": "error",
        "Object Pools": {
            "Array Implementation": "pools_array_object_pool",
            "DLL Implementation": "pools_dll_object_pool"
        }
    }
];

typedoc.links = [
    {
        "label": "Thermopylae",
        "url": "https://marinrusu1997.github.io/thermopylae"
    },
    {
        "label": "Github",
        "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/lib.pool"
    }
];

module.exports = typedoc;
