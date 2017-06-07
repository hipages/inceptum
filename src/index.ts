import { ExtendedError } from './util/ErrorUtil';
import * as _ErrorUtil from './util/ErrorUtil';
import { InceptumApp } from './app/InceptumApp';
import * as _Context from './ioc/Context';
import * as _PreinstantiatedSingletonDefinition from './ioc/objectdefinition/PreinstantiatedSingletonDefinition';
import * as _InceptumApp from './app/InceptumApp';
import * as _LogManager from './log/LogManager';

export namespace ioc {
  export const Context = _Context.Context;
  export namespace objectdefinition {
    export const PreinstantiatedSingletonDefinition = _PreinstantiatedSingletonDefinition.PreinstantiatedSingletonDefinition;
  }
}

export namespace app {
  export const InceptumApp = _InceptumApp.InceptumApp;
}

export namespace log {
  export const LogManager = _LogManager.LogManager;
  export const Logger = _LogManager.Logger;
}

export namespace util {
  export const ExtendedError = _ErrorUtil.ExtendedError;
}
