<h1 align="center">@thermopylae/demo.express</h1>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-0.0.1-blue.svg?cacheSeconds=2592000" />
  <img src="https://img.shields.io/badge/node-%3E%3D16-blue.svg"  alt="Node Version"/>
<a href="https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE" target="_blank">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</a>
</p>

> Demo application of the Thermopylae framework using ExpressJS.

## Install

```sh
npm install @thermopylae/demo.express
```

### Postinstall

Although [farmhash](https://www.npmjs.com/package/farmhash), a dependency used by this package, has prebuilt binaries
it would be recommended to rebuild them.

```shell
npm rebuild --build-from-source farmhash
```

Also, please consider to [update geoip-lite local database](https://www.npmjs.com/package/geoip-lite#built-in-updater).

## Description

This package contains an implementation of authentication service using Thermopylae framework.

## Prerequisites

### Configuration Files

The following config files need to be created. <br/>
├─ redis <br/>
│ ├─ [regular.json](https://github.com/marinrusu1997/thermopylae/blob/master/packages/demo.express/lib/validation/schemes/config/redis.json) <br/>
│ └─ [subscriber.json](https://github.com/marinrusu1997/thermopylae/blob/master/packages/demo.express/lib/validation/schemes/config/redis.json) <br/>
└─ [app.json](https://github.com/marinrusu1997/thermopylae/blob/master/packages/demo.express/lib/validation/schemes/config/app.json) <br/>
└─ [authentication.json](https://github.com/marinrusu1997/thermopylae/blob/master/packages/demo.express/lib/validation/schemes/config/auth-engine.json) <br/>
└─ [email.json](https://github.com/marinrusu1997/thermopylae/blob/master/packages/demo.express/lib/validation/schemes/config/email.json) <br/>
└─ [geoip.json](https://github.com/marinrusu1997/thermopylae/blob/master/packages/demo.express/lib/validation/schemes/config/geoip.json) <br/>
└─ [jwt.json](https://github.com/marinrusu1997/thermopylae/blob/master/packages/demo.express/lib/validation/schemes/config/jwt.json) <br/>
└─ [logger.json](https://github.com/marinrusu1997/thermopylae/blob/master/packages/demo.express/lib/validation/schemes/config/logger.json) <br/>
└─ [mysql.json](https://github.com/marinrusu1997/thermopylae/blob/master/packages/demo.express/lib/validation/schemes/config/mysql.json) <br/>
└─ [sms.json](https://github.com/marinrusu1997/thermopylae/blob/master/packages/demo.express/lib/validation/schemes/config/sms.json) <br/>

### Environment Variables

The **CONFIG_FILES_PATH** env var needs to be set with a value equal to directory absolute path
where application config files described in previous step are located.

### Databases

MySQL 8 and Redis 6 Server instances need to be started.
Keyspace notification events need to be enabled on Redis Server.
Apache Kafka broker needs to be started.

## Usage

```typescript
import { bootstrap } from '@thermopylae/demo.express';

bootstrap();
```

## Author

👤 **Rusu Marin**

- GitHub: [@marinrusu1997](https://github.com/marinrusu1997)
- Email: [dimarusu2000@gmail.com](mailto:dimarusu2000@gmail.com)
- LinkedIn: [@marinrusu1997](https://linkedin.com/in/marinrusu1997)

## 📝 License

Copyright © 2021 [Rusu Marin](https://github.com/marinrusu1997). <br/>
This project is [MIT](https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE) licensed.
