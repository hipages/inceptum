// tslint:disable:prefer-function-over-method
import { BaseSingletonDefinition } from '../ioc/objectdefinition/BaseSingletonDefinition';
import BaseApp, { Plugin } from '../app/BaseApp';
import { PostgresClient } from './PostgresClient';

export default class PostgresPlugin implements Plugin {
  name: 'PostgresPlugin';

  getName() {
    return this.name;
  }

  willStart(app: BaseApp) {
    if (!app.hasConfig('postgres')) {
      throw new Error('PostgresPlugin has been registered but could not find config using key "postgres"');
    }

    const context = app.getContext();
    const confs = context.getConfig('postgres');
    Object.keys(confs).forEach((key) => {
      const clientSingleton = new BaseSingletonDefinition<any>(PostgresClient, key);
      clientSingleton.setPropertyByValue('name', key);
      clientSingleton.setPropertyByValue('configuration', confs[key]);
      context.registerSingletons(clientSingleton);
    });
  }
}
