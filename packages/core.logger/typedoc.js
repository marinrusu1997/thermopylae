const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.exclude.push('lib/transports-manager.ts');
typedoc.exclude.push('lib/typings.d.ts');

typedoc.outline = [
    {
        "Error": "error",
        "Formatting": "formatting_manager",
        "Logger": "logger",
        "Transports": {
            "Console": "transports_console",
            "File": "transports_file",
            "Graylog2": "transports_graylog",
        }
    }
];

typedoc.links = [{
    "label": "Github",
    "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/core.logger"
}]

module.exports = typedoc;
