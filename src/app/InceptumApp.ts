import { Context } from '../ioc/Context';
import { LogManager, Logger } from '../log/LogManager';
import { PreinstantiatedSingletonDefinition } from '../ioc/objectdefinition/PreinstantiatedSingletonDefinition';
import { ObjectDefinitionStartStopMethodsInspector } from '../ioc/autoconfig/ObjectDefinitionStartStopMethodsInspector';
import { ObjectDefinitionLazyLoadingInspector } from '../ioc/autoconfig/ObjectDefinitionLazyLoadingInspector';
import { LifecycleState } from '../ioc/Lifecycle';
import MysqlPlugin from '../mysql/MysqlPlugin';
import PostgresPlugin from '../postgres/PostgresPlugin';
import SqsWorkerPlugin from '../sqs/SqsWorkerPlugin';
import SqsClientPlugin from '../sqs/SqsClientPlugin';
import AutowirePlugin from './AutowirePlugin';
import LazyLoadingPlugin from './LazyLoadingPlugin';
import StartStopPlugin from './StartStopPlugin';
import BaseApp from './BaseApp';

export class InceptumApp extends BaseApp {
  /**
   * Creates a new Inceptum App
   */
  constructor(options = {}) {
    super(options);
    // Standard IOC plugins.
    this.register(new AutowirePlugin(), new LazyLoadingPlugin(), new StartStopPlugin());
    // TODO This is for backward compat, I'd like to remove it and be explicit
    if (this.hasConfig('mysql')) {
      this.logger.debug('Mysql Detected - Adding Plugin');
      this.register(new MysqlPlugin());
    }
    if (this.hasConfig('postgres')) {
      this.logger.debug('Postgres Detected - Adding Plugin');
      this.register(new PostgresPlugin());
    }
    if (this.hasConfig('sqsClient')) {
      this.logger.debug('sqsClient Detected - Adding Plugin');
      this.register(new SqsClientPlugin());
    }
    if (this.hasConfig('sqsWorker')) {
      this.logger.debug('sqsClient Detected - Adding Plugin');
      this.register(new SqsWorkerPlugin());
    }
  }
}
