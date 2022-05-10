const typedoc = require('@thermopylae/dev.environment').configs.typedoc;

typedoc.outline = [
    {
        "Authentication Engine": "engine",
        "Error": "error",
        "Authentication": {
            "Step": "authentication_step",
            "Challenge Response": "authentication_steps_challenge_response_step",
            "Recaptcha": "authentication_steps_recaptcha_step",
            "Two Factor": {
                "Interface": "authentication_2fa_interface",
                "Email": "authentication_2fa_email",
                "Sms": "authentication_2fa_sms",
                "Totp": "authentication_2fa_totp"
            }
        },
        "Password": {
            "Hashing": {
                "Options": "managers_password",
                "Interface": "managers_password_hash",
                "Argon2": "managers_password_hash_argon2"
            },
            "Strength": {
                "Interface": "managers_password_strength_policy",
                "Length": "managers_password_strength_length_policy",
                "Pwned": "managers_password_strength_pwned_policy",
                "Strength": "managers_password_strength_strength_policy"
            }
        },
        "Typings": {
            "Contexts": "types_contexts",
            "Enums": "types_enums",
            "Hooks": "types_hooks",
            "Models": "types_models",
            "Repositories": "types_repositories",
            "Sessions": "types_sessions",
            "Secret Encryption": "helpers_secret_encryptor",
            "Side Channels": "types_side_channels"
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
        "url": "https://github.com/marinrusu1997/thermopylae/tree/master/packages/lib.authentication"
    }
];

module.exports = typedoc;
