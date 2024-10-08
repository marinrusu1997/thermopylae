<h1 align="center">@thermopylae/lib.email</h1>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-0.0.1-blue.svg?cacheSeconds=2592000" />
  <img alt="Node Version" src="https://img.shields.io/badge/node-%3E%3D16-blue.svg"/>
<a href="https://marinrusu1997.github.io/thermopylae/lib.email/index.html" target="_blank">
  <img alt="Documentation" src="https://img.shields.io/badge/documentation-yes-brightgreen.svg" />
</a>
<a href="https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE" target="_blank">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</a>
</p>

> Email client.

## Install

```sh
npm install @thermopylae/lib.email
```

## Description
This package contains [EmailClient][email-client-link] which can send emails. <br/>
In order to accomplish this task, it uses internally [nodemailer](https://www.npmjs.com/package/nodemailer) npm package.

## Usage
```typescript
import { EmailClient } from '@thermopylae/lib.email';

(async function main() {
    const emailClient = new EmailClient({
        transport: {
            options: {
                service: 'gmail',
                auth: {
                    type: 'OAuth2',
                    user: 'sample_user@gmail.com',
                    clientId: 'CLIENT-ID',
                    clientSecret: 'CLIENT-SECRET',
                    refreshToken: 'REFRESH-TOKEN',
                    accessToken: 'ACCESS-TOKEN'
                }
            },
            defaults: {
                from: 'sample_user@gmail.com'
            }
        },
        hooks: {
            onTransportError(err) {
                console.error('Error encountered in email transport: ', err);
            },
            onTransportIdle() {
                console.info('Email transport is idle.');
            }
        }
    });
    
    const sentEmailInfo = await emailClient.send({
        to: ['anoter_user@example.com'],
        subject: 'Demo Email',
        text: 'Demo text'
    });
    console.log('Email has been sent. Details: ', JSON.stringify(sentEmailInfo));
    
    emailClient.close();
})();
```

## API Reference
API documentation is available [here][api-doc-link].

It can also be generated by issuing the following commands:
```shell
git clone git@github.com:marinrusu1997/thermopylae.git
cd thermopylae
yarn install
yarn workspace @thermopylae/lib.email run doc
```

## Author
👤 **Rusu Marin**

* GitHub: [@marinrusu1997](https://github.com/marinrusu1997)
* Email: [dimarusu2000@gmail.com](mailto:dimarusu2000@gmail.com)
* LinkedIn: [@marinrusu1997](https://www.linkedin.com/in/rusu-marin-1638b0156/)

## 📝 License
Copyright © 2021 [Rusu Marin](https://github.com/marinrusu1997). <br/>
This project is [MIT](https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE) licensed.

[api-doc-link]: https://marinrusu1997.github.io/thermopylae/lib.email/index.html
[email-client-link]: https://marinrusu1997.github.io/thermopylae/lib.email/classes/client.emailclient.html
