const { BaseSingletonDefinition } = require('../ioc/objectdefinition/BaseSingletonDefinition');
const { MysqlClient } = require('./MysqlClient');

class MysqlConfigManager {
  static registerSingletons(context) {
    if (!context.hasConfig('MySQL')) {
      // No Mysql configured. Skipping
      return;
    }
    const confs = context.getConfig('MySQL');
    Object.keys(confs).forEach((key) => {
      const clientSingleton = new BaseSingletonDefinition(MysqlClient, key);
      clientSingleton.setPropertyByValue('name', key);
      clientSingleton.setPropertyByValue('configuration', confs[key]);
      context.registerSingletons(clientSingleton);
    });
  }
}

module.exports = { MysqlConfigManager };
