require('./util/BluePatch');
const { Context } = require('./ioc/Context');
const LogManager = require('./log/LogManager');
const { PromiseUtil } = require('./util/PromiseUtil');
const { InceptumApp } = require('./app/InceptumApp');
const { PreinstantiatedSingletonDefinition } = require('./ioc/objectdefinition/PreinstantiatedSingletonDefinition');
const deepAssign = require('deep-assign');

module.exports = {
  app: {
    InceptumApp
  },
  ioc: {
    Context,
    objectdefinition: {
      PreinstantiatedSingletonDefinition
    }
  },
  log: {
    LogManager
  },
  util: {
    PromiseUtil,
    deepAssign
  }
};
