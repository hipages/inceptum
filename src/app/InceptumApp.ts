import ElasticsearchPlugin from '../elasticsearch/ElasticsearchPlugin';
import HealthCheckPlugin from '../health/HealthCheckPlugin';
import AdminPortPlugin from '../web/AdminPortPlugin';
import MysqlPlugin from '../mysql/MysqlPlugin';
import PostgresPlugin from '../postgres/PostgresPlugin';
import RabbitmqConsumerPlugin from '../rabbitmq/RabbitmqConsumerPlugin';
import RabbitmqProducerPlugin from '../rabbitmq/RabbitmqProducerPlugin';
import NewrelicPlugin from '../newrelic/NewrelicPlugin';
import SqsClientPlugin from '../sqs/SqsClientPlugin';
import SqsWorkerPlugin from '../sqs/SqsWorkerPlugin';
import BaseApp from './BaseApp';
import AutowirePlugin from './plugin/AutowirePlugin';
import DecoratorPlugin from './plugin/DecoratorPlugin';
import LazyLoadingPlugin from './plugin/LazyLoadingPlugin';
import StartStopPlugin from './plugin/StartStopPlugin';


export class InceptumApp extends BaseApp {
  /**
   * Creates a new Inceptum App
   */
  constructor(options = {}) {
    super(options);
    // Standard IOC plugins.
    this.register(new AutowirePlugin(), new LazyLoadingPlugin(), new StartStopPlugin(), new DecoratorPlugin(), new AdminPortPlugin(), new HealthCheckPlugin(), new NewrelicPlugin());
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
    if (this.hasConfig('rabbitmq.client')) {
      if (this.hasConfig('rabbitmq.consumer')) {
        this.logger.debug('rabbitmq consumer Detected - Adding Plugin');
        this.register(new RabbitmqConsumerPlugin());
      }
      if (this.hasConfig('rabbitmq.producer')) {
        this.logger.debug('rabbitmq producer Detected - Adding Plugin');
        this.register(new RabbitmqProducerPlugin());
      }
    }
  }
}
