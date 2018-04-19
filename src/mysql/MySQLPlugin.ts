// tslint:disable:prefer-function-over-method
import { BaseSingletonDefinition } from '../ioc/objectdefinition/BaseSingletonDefinition';
import BaseApp, { Plugin } from '../app/BaseApp';
import { MySQLClient } from './MySQLClient';
import { MySQLHealthCheck } from './MySQLHealthCheck';

export default class MySQLPlugin implements Plugin {
  name = 'MySQLPlugin';

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
      const clientSingleton = new BaseSingletonDefinition<any>(MySQLClient, key);
      const config = {...confs[key], name: key};
      clientSingleton.constructorParamByValue(config);
      context.registerSingletons(clientSingleton);

      if (confs[key].master) {
        const masterHealthCheck = new BaseSingletonDefinition<MySQLHealthCheck>(MySQLHealthCheck, `HC_${key}_master`);
        masterHealthCheck.constructorParamByValue(`mysql.${key}.master`);
        masterHealthCheck.constructorParamByValue(false);
        masterHealthCheck.setPropertyByRef('mysqlClient', key);
        context.registerDefinition(masterHealthCheck);
      }

      if (confs[key].slave) {
        const slaveHealthCheck = new BaseSingletonDefinition<MySQLHealthCheck>(MySQLHealthCheck, `HC_${key}_slave`);
        slaveHealthCheck.constructorParamByValue(`mysql.${key}.slave`);
        slaveHealthCheck.constructorParamByValue(true);
        slaveHealthCheck.setPropertyByRef('mysqlClient', key);
        context.registerDefinition(slaveHealthCheck);
      }
    });
  }
}
