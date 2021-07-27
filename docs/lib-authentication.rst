###############################
Authentication Library
###############################

The library encapsulates password and passwordless authentication mechanisms.

****************************
Installation
****************************

The library is available on npm repository and can be installed via the following command
::

   npm i @thermopylae/lib.authentication

****************************
Basic Usage
****************************

The library exports **AuthenticationEngine** class which contains all of the library features.
::
    import { AuthenticationEngine } from '@thermopylae/lib.authentication';
    import type { AuthenticationEngineOptions } from '@thermopylae/lib.authentication';

    const options: AuthenticationEngineOptions = { /* we will cover them bellow */ };
    const engine = new AuthenticationEngine(options);

    engine
        .changePassword({
            accountId: '1',
            oldPassword: 'iau90-ufj90ui90}[k',
            newPassword: '98vcnkla[?>;ol,pop',
            ip: '156.168.9.6'
        })
        .then(() => {
            console.log('Password changed successfully.');
        })
        .catch((e) => {
            console.error('Failed to change password.', e);
        });


****************************
Options
****************************
**AuthenticationEngine** has a set of options which control behaviour of it's methods. We will detail each of them bellow.

thresholds.maxFailedAuthAttempts
================================
Represents the number of maximum allowed failed authentication attempts into account. When this threshold is reached,
account will implicitly be locked for `ttl.accountDisableTimeout`_.

thresholds.failedAuthAttemptsRecaptcha
======================================
Represents the number of failed authentication attempts after which recaptcha validation needs to be performed.

ttl.authenticationSession
=========================
Represents time to live in seconds of the `AuthenticationSession`_.

ttl.failedAuthAttemptsSession
=============================
Represents time to live in seconds of the `FailedAuthenticationAttemptSession`_.

ttl.activateAccountSession
=============================
Represents time to live in seconds of the activate account token. In this case token and session are interchangeable,
because token represents the session.

ttl.forgotPasswordSession
=============================
Represents time to live in seconds of the forgot password token. In this case token and session are interchangeable,
because token represents the session.

ttl.accountDisableTimeout
=============================
Represents the timeout in seconds for which account will be disabled implicitly by the engine operations. We will detail
bellow the operations that might trigger account disabling.





