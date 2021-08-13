<h1 align="center">@thermopylae/core.authentication</h1>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-0.0.1-blue.svg?cacheSeconds=2592000" />
  <img alt="Node Version" src="https://img.shields.io/badge/node-%3E%3D16-blue.svg"/>
<a href="https://marinrusu1997.github.io/thermopylae/core.authentication/index.html" target="_blank">
  <img alt="Documentation" src="https://img.shields.io/badge/documentation-yes-brightgreen.svg" />
</a>
<a href="https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE" target="_blank">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</a>
</p>

> Implementation of repositories required by Authentication Library.

## Install

```sh
npm install @thermopylae/core.authentication
```

### Postinstall
Although [farmhash](https://www.npmjs.com/package/farmhash), a dependency used by this package, has prebuilt binaries
it would be recommended to rebuild them.
```shell
npm rebuild --build-from-source farmhash
```

## Prerequisites
Before being able to use this package you need to take following actions:

1. Deploy **Redis 6** and **MySQL 8** server instances

2. Create MySQL database having the [following minimal schema][test-fixtures-sql-schema]:
<a href="https://dbdesigner.page.link/LwHWf38hE89bgQvm7">
  <img src="https://raw.githubusercontent.com/marinrusu1997/thermopylae/master/assets/img/thermopylae-db-schema.png">
</a>

3. Configure core logging. Example:

```typescript
import { DefaultFormatters, LoggerManagerInstance, OutputFormat } from '@thermopylae/core.logger';
import { ClientModule } from '@thermopylae/core.declarations';

LoggerManagerInstance.formatting.setDefaultFormattingOrder(OutputFormat.PRINTF, {
  colorize: true,
  skippedFormatters: new Set([DefaultFormatters.TIMESTAMP]),
  levelForLabel: {
    [ClientModule.MYSQL]: 'info',
    [ClientModule.REDIS]: 'info'
  }
});
LoggerManagerInstance.console.createTransport({ level: 'info' });
```

4. Enable loggers of database clients. Example:

```typescript
import { initLogger as initMySqlLogger } from '@thermopylae/core.mysql';
import { initLogger as initRedisClientLogger } from '@thermopylae/core.redis';

initMySqlLogger();
initRedisClientLogger();
```

5. Init database clients. Example:

```typescript
import { MySqlClientInstance } from '@thermopylae/core.mysql';
import { ConnectionType, DebuggableEventType, RedisClientInstance } from '@thermopylae/core.redis';

MySqlClientInstance.init({
  pool: {
      host: '127.0.0.1',
      port: 3306,
      user: 'your-user',
      password: 'your-password',
      database: 'your-database'
  }
});

await RedisClientInstance.connect({
  [ConnectionType.REGULAR]: {
      host: '127.0.0.1',
      port: 3306,
      password: 'your-password',
      connect_timeout: 10_000,
      max_attempts: 10,
      retry_max_delay: 5_000,
      attachDebugListeners: new Set<DebuggableEventType>(['end', 'reconnecting'])
  }
});
```

## Description
This package contains implementations of the repositories required by [@thermopylae/lib.authentication][lib-authentication-link].
You can create instances of these repositories and pass them as config to **@thermopylae/lib.authentication**.

Repositories are grouped in two categories:
* **mysql** - these repositories use MySQL database as underlying storage
    * [AccountMySqlRepository](https://marinrusu1997.github.io/thermopylae/core.authentication/classes/repositories_mysql_account.accountmysqlrepository.html)
    * [FailedAuthenticationsMysqlRepository](https://marinrusu1997.github.io/thermopylae/core.authentication/classes/repositories_mysql_failed_authentications.failedauthenticationsmysqlrepository.html)
    * [SuccessfulAuthenticationsMysqlRepository](https://marinrusu1997.github.io/thermopylae/core.authentication/classes/repositories_mysql_successful_authentication.successfulauthenticationsmysqlrepository.html)
* **redis** - these repositories use Redis database as underlying storage
    * [ActivateAccountSessionRedisRepository](https://marinrusu1997.github.io/thermopylae/core.authentication/classes/repositories_redis_activate_account_session.activateaccountsessionredisrepository.html)
    * [AuthenticationSessionRedisRepository](https://marinrusu1997.github.io/thermopylae/core.authentication/classes/repositories_redis_authentication_session.authenticationsessionredisrepository.html)
    * [FailedAuthenticationAttemptsSessionRedisRepository](https://marinrusu1997.github.io/thermopylae/core.authentication/classes/repositories_redis_failed_authentications_session.failedauthenticationattemptssessionredisrepository.html)
    * [ForgotPasswordSessionRedisRepository](https://marinrusu1997.github.io/thermopylae/core.authentication/classes/repositories_redis_forgot_password_session.forgotpasswordsessionredisrepository.html)

## Usage
Bellow is an example of how the repositories implementations from this package can be used in order to instantiate *AuthenticationEngine*. @FIXME LINK

```typescript
import { AccountWithTotpSecret, AuthenticationEngine } from '@thermopylae/lib.authentication';
import {
  AccountMySqlRepository,
  FailedAuthenticationsMysqlRepository,
  SuccessfulAuthenticationsMysqlRepository,
  ActivateAccountSessionRedisRepository,
  AuthenticationSessionRedisRepository,
  FailedAuthenticationAttemptsSessionRedisRepository,
  ForgotPasswordSessionRedisRepository
} from '@thermopylae/core.authentication';

// setup decribed above in `Prerequisites` chapter

const AUTHENTICATION_ENGINE = new AuthenticationEngine<AccountWithTotpSecret>({
  // config params...
  repositories: {
    account: new AccountMySqlRepository(),
    successfulAuthentications: new SuccessfulAuthenticationsMysqlRepository(),
    failedAuthenticationAttempts: new FailedAuthenticationsMysqlRepository(),
    authenticationSession: new AuthenticationSessionRedisRepository('actv-acc'),
    failedAuthAttemptSession: new FailedAuthenticationAttemptsSessionRedisRepository('fail-auth'),
    forgotPasswordSession: new ForgotPasswordSessionRedisRepository('fgt-pwd'),
    activateAccountSession: new ActivateAccountSessionRedisRepository('actv-acc')
  }
});

// use authentication engine
AUTHENTICATION_ENGINE.enableAccount('acount-id');
```

## API Reference
API documentation is available [here][api-doc-link].

It can also be generated by issuing the following commands:
```shell
git clone git@github.com:marinrusu1997/thermopylae.git
cd thermopylae
yarn install
yarn workspace @thermopylae/core.authentication run doc
```

## Author

👤 **Rusu Marin**

* GitHub: [@marinrusu1997](https://github.com/marinrusu1997)
* Email: [dimarusu2000@gmail.com](mailto:dimarusu2000@gmail.com)
* LinkedIn: [@marinrusu1997](https://www.linkedin.com/in/rusu-marin-1638b0156/)

## 📝 License

Copyright © 2021 [Rusu Marin](https://github.com/marinrusu1997). <br/>
This project is [MIT](https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE) licensed.

[api-doc-link]: https://marinrusu1997.github.io/thermopylae/core.authentication/index.html
[lib-authentication-link]: https://marinrusu1997.github.io/thermopylae/lib-authentication/index.html
[test-fixtures-sql-schema]: https://github.com/marinrusu1997/thermopylae/blob/master/packages/core.authentication/test/fixtures/setup.sql
