"use strict";
const del = require("del");

function clean() {
  return del(["dist", "build", ".nyc_output", "coverage"]);
}

function purge() {
   return clean().then(() => del(['node_modules', 'package-lock.json']));
}

module.exports = {
  clean,
  purge
};
