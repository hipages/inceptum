import { MetricsManager } from '../metrics/Metrics';
import { Context } from '../ioc/Context';
import co from 'co';
import LogManager, { Logger } from '../log/LogManager';
import { MysqlConfigManager } from '../mysql/MysqlConfigManager';
import { PreinstantiatedSingletonDefinition } from '../ioc/objectdefinition/PreinstantiatedSingletonDefinition';
import { ObjectDefinitionAutowiringInspector } from '../ioc/autoconfig/ObjectDefinitionAutowiringInspector';
import { ObjectDefinitionStartStopMethodsInspector } from '../ioc/autoconfig/ObjectDefinitionStartStopMethodsInspector';
import { ObjectDefinitionLazyLoadingInspector } from '../ioc/autoconfig/ObjectDefinitionLazyLoadingInspector';

class InceptumApp {


  context: Context;
  appName: string;
  logger: Logger;

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
    this.context.addObjectDefinitionInspector(new ObjectDefinitionLazyLoadingInspector());
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
