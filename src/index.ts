import './util/BluePatch';
import { Context } from './ioc/Context';
import LogManager from './log/LogManager';
import { PromiseUtil } from './util/PromiseUtil';
import { InceptumApp } from './app/InceptumApp';
import { PreinstantiatedSingletonDefinition } from './ioc/objectdefinition/PreinstantiatedSingletonDefinition';


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
    PromiseUtil
  }
};
