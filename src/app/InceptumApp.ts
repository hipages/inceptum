import ElasticsearchPlugin from '../elasticsearch/ElasticsearchPlugin';
import HealthCheckPlugin from '../health/HealthCheckPlugin';
import AdminPortPlugin from '../web/AdminPortPlugin';
import MySQLPlugin from '../mysql/MySQLPlugin';
import PostgresPlugin from '../postgres/PostgresPlugin';
import RabbitmqClientPlugin from '../rabbitmq/RabbitmqClientPlugin';
import NewrelicPlugin from '../newrelic/NewrelicPlugin';
import SqsClientPlugin from '../sqs/SqsClientPlugin';
import SqsWorkerPlugin from '../sqs/SqsWorkerPlugin';
import MetricsPlugin from '../metrics/MetricsPlugin';
import BaseApp, { AppOptions } from './BaseApp';
import AutowirePlugin from './plugin/AutowirePlugin';
import DecoratorPlugin from './plugin/DecoratorPlugin';
import LazyLoadingPlugin from './plugin/LazyLoadingPlugin';
import StartStopPlugin from './plugin/StartStopPlugin';

export interface InceptumAppOptions extends AppOptions {
  enableAdminPort?: boolean,
  enableHealthChecks?: boolean,
  enableMetrics?: boolean,
}

export const DEFAULT_INCEPTUM_APP_OPTIONS: InceptumAppOptions = {
  enableAdminPort: true,
  enableHealthChecks: true,
  enableMetrics: true,
  shutdownTimer: process.env.NODE_ENV === 'production' ? 20000 : 200,
};

export class InceptumApp extends BaseApp {
  /**
   * Creates a new Inceptum App
   */
  constructor(options: InceptumAppOptions = DEFAULT_INCEPTUM_APP_OPTIONS) {
    super(options);
    // Standard IOC plugins.
    this.register(new AutowirePlugin(), new LazyLoadingPlugin(), new StartStopPlugin(), new DecoratorPlugin());
    if (options.enableAdminPort) {
      this.register(new AdminPortPlugin());
    }
    if (options.enableHealthChecks) {
      this.register(new HealthCheckPlugin());
    }
    if (options.enableMetrics) {
      this.register(new MetricsPlugin());
    }
    this.register(new NewrelicPlugin());
    // TODO This is for backward compat, I'd like to remove it and be explicit
    if (this.hasConfig('mysql')) {
      this.logger.debug('Mysql Detected - Adding Plugin');
      this.register(new MySQLPlugin());
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
      this.logger.debug('rabbitmq Detected - Adding Plugin');
      this.register(new RabbitmqClientPlugin());
    }
  }
}

export class TestInceptumApp extends InceptumApp {
  constructor(ops = {}) {
    super({
      enableAdminPort: false,
      enableHealthChecks: false,
      enableMetrics: false,
      ...ops});
  }
  async start() {
    process.removeAllListeners();
    await super.start();
  }
}
