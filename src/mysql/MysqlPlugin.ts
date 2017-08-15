// tslint:disable:prefer-function-over-method
import { BaseSingletonDefinition } from '../ioc/objectdefinition/BaseSingletonDefinition';
import BaseApp, { Plugin } from '../app/BaseApp';
import { MysqlClient } from './MysqlClient';

export default class MysqlPlugin implements Plugin {
  name = 'MysqlPlugin';

  getName() {
    return this.name;
  }

  willStart(app: BaseApp) {
    if (!app.hasConfig('mysql')) {
      throw new Error('MysqlPlugin has been registered but could not find config using key "mysql"');
    }

    const context = app.getContext();
    const confs = context.getConfig('mysql');
    Object.keys(confs).forEach((key) => {
      const clientSingleton = new BaseSingletonDefinition<any>(MysqlClient, key);
      clientSingleton.setPropertyByValue('name', key);
      clientSingleton.setPropertyByValue('configuration', confs[key]);
      context.registerSingletons(clientSingleton);
    });
  }
}
