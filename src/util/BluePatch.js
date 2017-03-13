const bluebirdPromise = require('bluebird');
const cls = require('continuation-local-storage');
const clsBluebird = require('cls-bluebird');

const ns = cls.createNamespace('transaction');

clsBluebird(ns);

global.Promise = bluebirdPromise;
