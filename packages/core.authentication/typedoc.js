const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.exclude.push('lib/repositories/constants.ts');

typedoc.outline = [
    {
        "Error": "error",
        "MySQL": {
            "Account": "repositories_mysql_account",
            "Failed Authentications": "repositories_mysql_failed_authentications",
            "Successful Authentications": "repositories_mysql_successful_authentication",
        },
        "Redis": {
            "Activate Account Session": "repositories_redis_activate_account_session",
            "Authentication Session": "repositories_redis_authentication_session",
            "Failed Authentication Attempts Session": "repositories_redis_failed_authentications_session",
            "Forgot Password Session": "repositories_redis_forgot_password_session",
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
        "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/core.authentication"
    }
];

module.exports = typedoc;
