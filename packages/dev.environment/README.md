<h1 align="center">@thermopylae/dev.environment</h1>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-0.0.1-blue.svg?cacheSeconds=2592000" />
  <img src="https://img.shields.io/badge/node-%3E%3D16-blue.svg"  alt="Node Version"/>
<a href="https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE" target="_blank">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</a>
</p>

> Development environment for Thermopylae modules.

## Install

```sh
npm install @thermopylae/dev.environment --dev
```

## Description
This package contains a collection of tools used in the development process of Thermopylae packages, such as:

* gulp tasks (e.g. build, lint, test, doc)
* dependencies to dev tools (e.g. eslint, mocha, typedoc)
* configs for dev tools

# Usage
Bellow are simple examples of how this module can be used:

* **gulpfile.js**
```javascript
"use strict";
module.exports = require('@thermopylae/dev.environment').gulpfile;
```
* **.eslintrc.js**
```javascript
module.exports = require('@thermopylae/dev.environment').configs.eslint;
```
* **tsconfig.json**
```json
{
    "extends": "../../node_modules/@thermopylae/dev.environment/lib/configs/tsconfig.json",
    "compilerOptions": {
        "rootDir": ".",
        "tsBuildInfoFile": "build/tsbuildinfo",
        "outDir": "dist",
        "module": "commonjs"
    },
    "include": [
        "lib/**/*.ts",
        "test/**/*.ts"
    ]
}
```

## Author

👤 **Rusu Marin**

* GitHub: [@marinrusu1997](https://github.com/marinrusu1997)
* Email: [dimarusu2000@gmail.com](mailto:dimarusu2000@gmail.com)
* LinkedIn: [@marinrusu1997](https://linkedin.com/in/marinrusu1997)

## 📝 License

Copyright © 2021 [Rusu Marin](https://github.com/marinrusu1997). <br/>
This project is [MIT](https://github.com/marinrusu1997/thermopylae/blob/master/LICENSE) licensed.
