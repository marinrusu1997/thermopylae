const typedoc = require('@thermopylae/module-builder').configs.typedoc;
typedoc.externalPattern = [
    'lib/error.ts'
];
typedoc.outline = [
    {
        "Client": "client",
        "ConnectionsManager": "connections_interface",
        "PoolClusterConnectionsManager": "connections_cluster",
        "Logging": "logger",
        "Utils": "utils"
    }
];
typedoc.links = [{
    "label": "Bitbucket",
    "url": "https://bitbucket.org/marinrusu1997/framework/src/master/packages/core.mysql/"
}]

module.exports = typedoc;
