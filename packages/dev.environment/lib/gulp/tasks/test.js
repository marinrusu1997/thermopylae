"use strict";

const npmRun = require("npm-run");
const constants = require('../../constants');

function test() {
  return npmRun.spawn("mocha", [], constants.SPAWN_OPTIONS);
}

function debug() {
  return npmRun.spawn("mocha", ['--inspect-brk'], constants.SPAWN_OPTIONS);
}

function report() {
  const reporterOpts = {
      reportDir: 'report',
      reportFilename: 'index',
      charts: true,
      code: false,
      autoOpen: true,
      showSkipped: true,
      saveJson: true,
      saveHtml: true
  };

  const reporterArgs = [
      '--reporter', 'mochawesome',
      '--reporter-options', `${Object.entries(reporterOpts).map(opt => opt.join('=')).join(',')}`
  ];

  return npmRun.spawn("mocha", reporterArgs, constants.SPAWN_OPTIONS);
}

module.exports = {
  test,
  debug,
  report
};
