"use strict";

const npmRun = require("npm-run");
const fs = require('fs-extra');
const del = require('del');
const path = require('path');
const constants = require('../../constants');
const typedoc = require('../../configs/typedoc');

async function doc() {
    const packageObj = await fs.readJson('package.json');
    const packageName = constants.PACKAGE_NAME_REGEXP.exec(packageObj.name)[2];
    const destination = path.join('..', '..', 'docs', packageName);

    await del(typedoc.out);
    await new Promise((resolve, reject) => {
        npmRun.spawn("typedoc", ["--options", "typedoc.cjs"], constants.SPAWN_OPTIONS)
            .on('exit', function (code) {
                code === 0 ? resolve() : reject();
            });
    });

    await del(destination, { force: true });
    await fs.copy(typedoc.out, destination);

    await del(typedoc.out);
    await fs.ensureSymlink(destination, typedoc.out);
}

module.exports = doc;

