import { BaseSingletonDefinition } from '../ioc/objectdefinition/BaseSingletonDefinition';
import { Context } from '../ioc/Context';
import { PostgresClient } from './PostgresClient';

export class PostgresConfigManager {
  static registerSingletons(context: Context) {
    if (!context.hasConfig('postgres')) {
      // No Mysql configured. Skipping
      return;
    }
    const confs = context.getConfig('postgres');
    Object.keys(confs).forEach((key) => {
      const clientSingleton = new BaseSingletonDefinition<any>(PostgresClient, key);
      clientSingleton.setPropertyByValue('name', key);
      clientSingleton.setPropertyByValue('configuration', confs[key]);
      context.registerSingletons(clientSingleton);
    });
  }
}
