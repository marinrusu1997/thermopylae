#!/bin/bash
npm i
cd node_modules/geoip-lite && npm run-script updatedb
cd ../..
