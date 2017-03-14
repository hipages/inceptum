// const bluebirdPromise = require('bluebird');
// const cls = require('continuation-local-storage');
// const clsBluebird = require('cls-bluebird');

// const ns = cls.createNamespace('transaction');

// clsBluebird(ns);

// global.Promise = bluebirdPromise;

// eslint-disable-next-line no-extend-native
global.PromiseUtil = {};

global.PromiseUtil.try = (f) => new Promise((resolve, reject) => {
  try {
    resolve(f());
  } catch (e) {
    reject(e);
  }
});

console.log(global.PromiseUtil.try);

global.Promise.prototype.finally = function (f) {
  return this.then((r) => {
    f(r);
    return r;
  },
  (r) => {
    f(r);
    throw r;
  });
};
