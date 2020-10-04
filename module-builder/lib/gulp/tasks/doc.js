"use strict";

const npmRun = require("npm-run");
const constants = require('../../constants');

function doc() {
    return npmRun.spawn("typedoc", [], constants.SPAWN_OPTIONS);
}

module.exports = doc;

