// tslint:disable:prefer-function-over-method
import { BaseSingletonDefinition } from '../ioc/objectdefinition/BaseSingletonDefinition';
import BaseApp, { Plugin } from '../app/BaseApp';
import {SqsClient} from "./SqsClient";

export default class SqsClientPlugin implements Plugin {
  name = 'SqsClientPlugin';

  getName() {
    return this.name;
  }

  willStart(app: BaseApp) {
    if (!app.hasConfig('SqsClient')) {
      throw new Error('SqsClientPlugin has been registered but could not find config using key "mysql"');
    }

    const context = app.getContext();
    const confs = context.getConfig('SqsClient');
    Object.keys(confs).forEach((key) => {
      const clientSingleton = new BaseSingletonDefinition<any>(SqsClient, key);
      clientSingleton.constructorParamByValue(confs[key]);
      clientSingleton.constructorParamByValue(key);
      context.registerSingletons(clientSingleton);
    });
  }
}
