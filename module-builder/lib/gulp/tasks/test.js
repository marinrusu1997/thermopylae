"use strict";

const npmRun = require("npm-run");
const constants = require('../../constants');

function test() {
  return npmRun.spawn("mocha", [], constants.SPAWN_OPTIONS);
}

function debug() {
  return npmRun.spawn("mocha", ['--inspect-brk'], constants.SPAWN_OPTIONS);
}

module.exports = {
  test,
  debug
};
