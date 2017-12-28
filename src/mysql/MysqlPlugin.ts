// tslint:disable:prefer-function-over-method
import { BaseSingletonDefinition } from '../ioc/objectdefinition/BaseSingletonDefinition';
import BaseApp, { Plugin } from '../app/BaseApp';
import { MysqlClient } from './MysqlClient';
import { MysqlHealthCheck } from './MysqlHealthCheck';

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

      const masterHealthCheck = new BaseSingletonDefinition<MysqlHealthCheck>(MysqlHealthCheck, `HC_${key}_master`);
      masterHealthCheck.constructorParamByValue(`mysql.${key}.master`);
      masterHealthCheck.constructorParamByValue(false);
      masterHealthCheck.setPropertyByRef('mysqlClient', key);
      context.registerDefinition(masterHealthCheck);

      const slaveHealthCheck = new BaseSingletonDefinition<MysqlHealthCheck>(MysqlHealthCheck, `HC_${key}_slave`);
      slaveHealthCheck.constructorParamByValue(`mysql.${key}.slave`);
      slaveHealthCheck.constructorParamByValue(true);
      slaveHealthCheck.setPropertyByRef('mysqlClient', key);
      context.registerDefinition(slaveHealthCheck);
    });
  }
}
