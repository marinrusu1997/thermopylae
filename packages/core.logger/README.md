<h1 align="center">@thermopylae/core.authentication</h1>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-0.0.1-blue.svg?cacheSeconds=2592000" />
  <img alt="Node Version" src="https://img.shields.io/badge/node-%3E%3D16-blue.svg"/>
<a href="https://marinrusu1997.github.io/thermopylae/core.logger/index.html" target="_blank">
  <img alt="Documentation" src="https://img.shields.io/badge/documentation-yes-brightgreen.svg" />
</a>
<a href="https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE" target="_blank">
  <img alt="License: ISC" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</a>
</p>

> Logger for core Thermopylae modules.

## Install

```sh
npm install @thermopylae/core.logger
```

## Description
This package contains logging infrastructure used by Thermopylae *core.** modules.
This infrastructure can also be used by applications built with Thermopylae framework.

Logging is implemented with the help of [winston](https://www.npmjs.com/package/winston) npm package.

## Usage
Package exports a singleton instance of the [LoggerManager][logger-manager-class-link] class, named *LoggerManagerInstance*. <br/>
Before obtaining logger, you need to configure formatting and transports of the *LoggerManagerInstance*.

### Formatting
[Formatting Manager][formatting-manager-link] has a set of [predefined formatters][default-formatters-link]. <br/>
You can also define your custom formatters by using [setFormatter][formatting-manager-set-formatter-link]. <br/>
Formatters can be removed by using [removeFormatter][formatting-manager-remove-formatter-link].
```typescript
import { format } from 'winston';
import chalk from 'chalk';
import { LoggerManagerInstance, DefaultFormatters } from '@thermopylae/core.logger';

LoggerManagerInstance.formatting.setFormatter('italic', format((info) => {
    info['message'] = chalk.italic(info['message']);
    return info;
})());

LoggerManagerInstance.formatting.removeFormatter('italic'); // you can remove your formatters...
LoggerManagerInstance.formatting.removeFormatter(DefaultFormatters.TIMESTAMP); // ...or the default ones
```

<br/>

After defining your own formatters (which is an optional step), you need to set an order in which formatters will be applied. <br/>
This task can be accomplished by using either [setCustomFormattingOrder][formatting-manager-set-custom-formatting-order-link],
or [setDefaultFormattingOrder][formatting-manager-set-default-formatting-order-link]. <br/>
*setCustomFormattingOrder* allows you to set a custom order from all formatters, or only a part of them. <br/>
*setDefaultFormattingOrder* allows you to choose from a set of predefined formatter orders, called [OutputFormat][output-format-link]s.
All output formats have the same configurable formatting order, varying only in the last formatter, which is the one of output format name.
```typescript
import { LoggerManagerInstance, DefaultFormatters, OutputFormat } from '@thermopylae/core.logger';
import { DevModule, CoreModule } from '@thermopylae/core.declarations';

// setting up a custom order
LoggerManagerInstance.formatting.setCustomFormattingOrder([
   DefaultFormatters.TIMESTAMP, DefaultFormatters.JSON
]);

// change it with a default one (overwrites the previous one)
LoggerManagerInstance.formatting.setDefaultFormattingOrder(OutputFormat.PRINTF, {
    // colorize logging messages (to be used only with console transport)
    colorize: true,
    // log messages containing these labels won't be displayed
    ignoredLabels: new Set([DevModule.UNIT_TESTING]),
    // configure specific logging level per label different from transport level
    levelForLabel: {
        // notice this level need to be higher that transport levels, otherwise it has no effect
        [CoreModule.JWT_USER_SESSION]: 'info'
    },
    // these formatters won't be included in the formatting order
    skippedFormatters: new Set([DefaultFormatters.ALIGN])
});
```
Notice that if you pass ```{ colorize: true }```, only Thermopylae *ClientModule*, *CoreModule* and *DevModule* labels will be colorized.
If you need additional labels to be colorized (e.g. you are developing your own app module), pass an object having label as key and color as value.
```typescript
{
    // this will colorize ClientModule + CoreModule + DevModule + labels defined in the object bellow
    colorize: {
        'MY-APP-MODULE': 'magenta'
    }
}
```

<br/>

When using [OutputFormat.PRINTF][output-format-printf-link] and application runs in cluster mode, you can include cluster node id in the logged message.
```typescript
import { LoggerManagerInstance } from '@thermopylae/core.logger';

LoggerManagerInstance.formatting.setClusterNodeId('slave-1');
```

### Transports
[LoggerManager][logger-manager-class-link] supports the following types of transport:
* [Console][console-transport-link]
* [File][file-transport-link]
* [Graylog2][graylog2-transport-link]

*LoggerManagerInstance* has no configured transports. The transports you configure, the ones will be used.
Therefore, you may use 1, 2 or 3 transports simultaneously.

#### Console
[Console][console-transport-link] transport represents the builtin Console transport from winston. It is intended
for development purposes and is the only transport which supports colored output.
Configuration example:
```typescript
import { LoggerManagerInstance } from '@thermopylae/core.logger';
import type { ConsoleTransportOptions } from 'winston/lib/winston/transports';

const options: ConsoleTransportOptions = {
    "level": "debug",
    "consoleWarnLevels": ["warning"],
    "stderrLevels": ["emerg", "alert", "crit", "error"]
};
LoggerManagerInstance.console.createTransport(options);

// from now on all log messages will be printed to console
```

#### File
[File][file-transport-link] allows you to write logs into file. It's a thin wrapper over [winston-daily-rotate-file](https://www.npmjs.com/package/winston-daily-rotate-file).
Configuration example:
```typescript
import { LoggerManagerInstance } from '@thermopylae/core.logger';

LoggerManagerInstance.file.createTransport({
    level: 'info',
    filename: 'application-%DATE%.log',
    datePattern: 'YYYY-MM-DD-HH',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d'
});
// if you want to attach event handlers (optional)
LoggerManagerInstance.file.get()!.on('new', (newFilename) => {
   console.log(`New log file created with name '${newFilename}'.`); 
});


// if you want to also log on console (optional)
LoggerManagerInstance.console.createTransport({
    level: 'info'
});
// now log messages will be written on console and into file
```

#### Graylog2
[Graylog2][graylog2-transport-link] transport allows you to write logs to [graylog server](https://docs.graylog.org/en/4.1/). <br/>
Configuration of this transport is done in 2 steps:
1. You need to register inputs where logs will be written, namely Graylog Server endpoints. Example:

```typescript
import { LoggerManagerInstance } from '@thermopylae/core.logger';

// let's register 2 inputs based on logs priority
LoggerManagerInstance.graylog2.register('HIGH', {
    host: '127.0.0.1', 
    port: 12201 
});
LoggerManagerInstance.graylog2.register('NORMAL', {
    host: '127.0.0.1',
    port: 12202
});
```
2. You need to set logging channels for application modules, namely decide into which input each module will write its logs. Example:

```typescript
import { LoggerManagerInstance } from '@thermopylae/core.logger';

/**
 * All application modules will write logs into 'NORMAL' input with log level above or equal to 'notice'.
 * Excepting 'CRITICAL-APP-MODULE', which will write logs into 'HIGH' input with log level above or equal to 'info'.
 */

LoggerManagerInstance.graylog2.setChannel('@all', {
    input: 'NORMAL',
    level: 'notice'
});
LoggerManagerInstance.graylog2.setChannel('CRITICAL-APP-MODULE', {
    input: 'HIGH',
    level: 'info'
});
```

### Creating loggers
After you configured formatting and transports, you can obtain loggers for app modules.
Due to the fact that you can't obtain logger before [LoggerManager][logger-manager-class-link] isn't configured (usually it will be configured in the boostrap phase),
the following approach is recommended:
* in the application packages, create a file called *logger.ts* having following content:

```typescript
import { LoggerInstance } from '@thermopylae/core.logger';
import type { WinstonLogger } from '@thermopylae/core.logger';

let logger: WinstonLogger;

function initLogger(): void {
    logger = LoggerInstance.for('MY-MODULE-NAME');
}

export { logger, initLogger };
```
* in the package files import **logger** from *logger.ts* and use it via [live binding mechanism](https://stackoverflow.com/a/57552682):

```typescript
// implementation.ts
import { logger } from './logger';

function print(msg: string) {
    logger.info(msg);
}

export { print };
```
* export initialization function from package entry point:

```typescript
// index.ts

export { initLogger } from './logger';
```
* at the application bootstrap configure [LoggerManager][logger-manager-class-link] and init loggers:

```typescript
// bootstrap.ts
import { LoggerManagerInstance, OutputFormat } from '@thermopylae/core.logger';
import { initLogger as initMyPackageLogger } from 'my-package';

// read configs from somewhere

/**
 * Configure logging. 
 * Notice that logging configuration needs to be one of the firstest steps in the app bootstrap. 
 */
LoggerManagerInstance.formatting.setDefaultFormattingOrder(OutputFormat.PRINTF, {
    colorize: true
});
LoggerManagerInstance.console.createTransport({
    level: 'info'
});

/**
 * Init app loggers.
 */
initMyPackageLogger();

// configure other application parts/systems
```

## API Reference
API documentation is available [here][api-doc-link].

It can also be generated by issuing the following commands:
```shell
git clone git@github.com:marinrusu1997/thermopylae.git
cd thermopylae
yarn install
yarn workspace @thermopylae/core.logger run doc
```

## Author

👤 **Rusu Marin**

* GitHub: [@marinrusu1997](https://github.com/marinrusu1997)
* Email: [dimarusu2000@gmail.com](mailto:dimarusu2000@gmail.com)
* LinkedIn: [@marinrusu1997](https://linkedin.com/in/marinrusu1997)

## 📝 License

Copyright © 2021 [Rusu Marin](https://github.com/marinrusu1997). <br/>
This project is [MIT](https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE) licensed.

[api-doc-link]: https://marinrusu1997.github.io/thermopylae/core.logger/index.html
[console-transport-link]: https://marinrusu1997.github.io/thermopylae/core.logger/classes/transports_console.consolelogsmanager.html
[file-transport-link]: https://marinrusu1997.github.io/thermopylae/core.logger/classes/transports_file.filelogsmanager.html
[graylog2-transport-link]: https://marinrusu1997.github.io/thermopylae/core.logger/modules/transports_graylog.html
[logger-manager-class-link]: https://marinrusu1997.github.io/thermopylae/core.logger/classes/logger_manager.loggermanager.html
[logger-manager-class-for-link]: https://marinrusu1997.github.io/thermopylae/core.logger/classes/logger_manager.loggermanager.html#for
[formatting-manager-link]: https://marinrusu1997.github.io/thermopylae/core.logger/classes/formatting_manager.formattingmanager.html
[formatting-manager-set-formatter-link]: https://marinrusu1997.github.io/thermopylae/core.logger/classes/formatting_manager.formattingmanager.html#setformatter
[formatting-manager-remove-formatter-link]: https://marinrusu1997.github.io/thermopylae/core.logger/classes/formatting_manager.formattingmanager.html#removeformatter
[formatting-manager-set-custom-formatting-order-link]: https://marinrusu1997.github.io/thermopylae/core.logger/classes/formatting_manager.formattingmanager.html#setcustomformattingorder
[formatting-manager-set-default-formatting-order-link]: https://marinrusu1997.github.io/thermopylae/core.logger/classes/formatting_manager.formattingmanager.html#setdefaultformattingorder
[default-formatters-link]: https://marinrusu1997.github.io/thermopylae/core.logger/enums/formatting_manager.defaultformatters.html
[output-format-link]: https://marinrusu1997.github.io/thermopylae/core.logger/enums/formatting_manager.outputformat.html
[output-format-printf-link]: https://marinrusu1997.github.io/thermopylae/core.logger/enums/formatting_manager.outputformat.html#printf
