const { MetricsManager } = require('../metrics/Metrics');
const { Context } = require('../ioc/Context');
const co = require('co');
const LogManager = require('../log/LogManager');
const { MysqlConfigManager } = require('../mysql/MysqlConfigManager');
const { PreinstantiatedSingletonDefinition } = require('../ioc/objectdefinition/PreinstantiatedSingletonDefinition');
const { ObjectDefinitionAutowiringInspector } = require('../ioc/autoconfig/ObjectDefinitionAutowiringInspector');
const { ObjectDefinitionStartStopMethodsInspector } = require('../ioc/autoconfig/ObjectDefinitionStartStopMethodsInspector');

class InceptumApp {
  /**
   * Creates a new Inceptum App
   */
  constructor(logger) {
    this.appName = Context.getConfig('app.name', 'TestApp');
    LogManager.setAppName(this.appName);
    this.context = new Context(Context.getConfig('app.context.name', 'BaseContext'));
    MetricsManager.registerSingletons(this.appName, this.context);
    this.context.addObjectDefinitionInspector(new ObjectDefinitionAutowiringInspector());
    this.context.addObjectDefinitionInspector(new ObjectDefinitionStartStopMethodsInspector());
    MysqlConfigManager.registerSingletons(this.context);
    this.context.registerDefinition(new PreinstantiatedSingletonDefinition(LogManager));
    this.logger = logger || LogManager.getLogger(__filename);
  }
  start() {
    const self = this;
    process.on('SIGINT', () => {
      co(self.stop().then(() => process.exit()));
    });
    return this.context.lcStart();
  }
  stop() {
    this.logger.info('Shutting down app');
    return this.context.lcStop();
  }
  getContext() {
    return this.context;
  }
  getConfig(key, defaultValue) {
    return Context.getConfig(key, defaultValue);
  }
}

module.exports = { InceptumApp };
