import { Context } from '../ioc/Context';
import { LogManager, Logger } from '../log/LogManager';
import { PreinstantiatedSingletonDefinition } from '../ioc/objectdefinition/PreinstantiatedSingletonDefinition';
import { LifecycleState } from '../ioc/Lifecycle';
import MysqlPlugin from '../mysql/MysqlPlugin';
import PostgresPlugin from '../postgres/PostgresPlugin';
import SqsWorkerPlugin from '../sqs/SqsWorkerPlugin';
import SqsClientPlugin from '../sqs/SqsClientPlugin';
import ElasticsearchPlugin from '../elasticsearch/ElasticsearchPlugin';
import AutowirePlugin from './plugin/AutowirePlugin';
import LazyLoadingPlugin from './plugin/LazyLoadingPlugin';
import StartStopPlugin from './plugin/StartStopPlugin';
import DecoratorPlugin from './plugin/DecoratorPlugin';
import BaseApp from './BaseApp';

export class InceptumApp extends BaseApp {
  /**
   * Creates a new Inceptum App
   */
  constructor(options = {}) {
    super(options);
    // Standard IOC plugins.
    this.register(new AutowirePlugin(), new LazyLoadingPlugin(), new StartStopPlugin(), new DecoratorPlugin());
    // TODO This is for backward compat, I'd like to remove it and be explicit
    if (this.hasConfig('mysql')) {
      this.logger.debug('Mysql Detected - Adding Plugin');
      this.register(new MysqlPlugin());
    }
    if (this.hasConfig('postgres')) {
      this.logger.debug('Postgres Detected - Adding Plugin');
      this.register(new PostgresPlugin());
    }
    if (this.hasConfig('SqsClient')) {
      this.logger.debug('SqsClient Detected - Adding Plugin');
      this.register(new SqsClientPlugin());
    }
    if (this.hasConfig('SqsWorker')) {
      this.logger.debug('SqsWorker Detected - Adding Plugin');
      this.register(new SqsWorkerPlugin());
    }
    if (this.hasConfig('elasticsearch')) {
      this.logger.debug('elasticsearch Detected - Adding Plugin');
      this.register(new ElasticsearchPlugin());
    }
  }
}
