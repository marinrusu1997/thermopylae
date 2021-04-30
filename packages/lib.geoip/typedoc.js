const typedoc = require('@thermopylae/module-builder').configs.typedoc;
typedoc.outline = [
    {
        "Repositories": {
            "Interface": "repository",
            "GeoIpLiteRepository": "repository_geoip_lite",
            "IpLocateRepository": "repository_iplocate",
            "IpstackRepository": "repository_ipstack"
        },
        "Locator": "geoip",
        "Logging": "logger"
    }
];
typedoc.links = [{
    "label": "Bitbucket",
    "url": "https://bitbucket.org/marinrusu1997/framework/src/master/packages/lib.geoip/"
}]

module.exports = typedoc;
