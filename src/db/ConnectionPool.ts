import { Summary, Gauge, Counter, register, Histogram } from 'prom-client';
import { createPool, Pool, Factory, Options } from 'generic-pool';

export interface ConnectionPoolOptions {
  name: string,
  readonly?: boolean,
  max?: number,
  min?: number,
  maxWaitingClients?: number,
  testOnBorrow?: boolean,
  acquireTimeoutMillis?: number,
  fifo?: boolean,
  autostart?: boolean,
  evictionRunIntervalMillis?: number,
  numTestsPerRun?: number,
  softIdleTimeoutMillis?: number,
  idleTimeoutMillis?: number,
}

const DEFAULT_CONNECTION_POOL_OPTIONS: ConnectionPoolOptions = {
  name: undefined,
  readonly: true,
  max: 10,
  min: 2,
  maxWaitingClients: 10,
  testOnBorrow: false,
  acquireTimeoutMillis: 1000,
  fifo: false,
  autostart: false,
  evictionRunIntervalMillis: 30000,
  numTestsPerRun: 3,
  softIdleTimeoutMillis: 20000,
  idleTimeoutMillis: 60000,
};

export abstract class ConnectionPool<T> {
  async abstract getConnection(): Promise<T>;
  async abstract release(connection: T);
  async abstract start();
  async abstract stop();
}

const connectErrorsCounter = new Counter({
  name: 'db_pool_connect_errors_counter',
  help: 'Number of times a connection attempt fails',
  labelNames: ['poolName', 'readonly'],
});
const acquireErrorsCounter = new Counter({
  name: 'db_pool_acquire_errors_counter',
  help: 'Number of times an acquire attempt fails',
  labelNames: ['poolName', 'readonly'],
});
const activeGauge = new Gauge({
  name: 'db_pool_active_connections_gauge',
  help: 'Number of active connections in the pool',
  labelNames: ['poolName', 'readonly'],
});
const acquireTimeHistogram = new Histogram({
  name: 'db_pool_acquire_time_histogram',
  help: 'Time required to acquire a connection from the pool',
  labelNames: ['poolName', 'readonly'],
  buckets: [0.003, 0.005, 0.01, 0.05, 0.1, 0.3],
});
const connectTimeHistogram = new Histogram({
  name: 'db_pool_connect_time_histogram',
  help: 'Time required to establish a new connection to the DB',
  labelNames: ['poolName', 'readonly'],
  buckets: [0.003, 0.005, 0.01, 0.05, 0.1, 0.3],
});
const useTimeHistogram = new Histogram({
  name: 'db_pool_use_time_histogram',
  help: 'Time a connection is kept out of the pool',
  labelNames: ['poolName', 'readonly'],
  buckets: [0.003, 0.005, 0.01, 0.05, 0.1, 0.3],
});

class InstrumentedFactory<T> implements Factory<T> {
  connectErrorsCounter: Counter.Internal;
  connectTimeHistogram: Histogram.Internal;
  factory: Factory<T>;
  options: ConnectionPoolOptions;
  constructor(factory: Factory<T>, options: ConnectionPoolOptions) {
    this.options = options;
    this.factory = factory;
    const labels = [options.name, options.readonly ? 'true' : 'false'];
    this.connectTimeHistogram = connectTimeHistogram.labels(...labels);
    this.connectErrorsCounter = connectErrorsCounter.labels(...labels);
  }
  async create(): Promise<T> {
    const timer = this.connectTimeHistogram.startTimer();
    try {
      return await this.factory.create();
    } catch (e) {
      this.connectErrorsCounter.inc();
      throw e;
    } finally {
      timer();
    }
  }
  async destroy(client: T): Promise<undefined> {
    return await this.factory.destroy(client);
  }
  async validate(client: T): Promise<boolean> {
    if (this.factory.validate) {
      return await this.factory.validate(client);
    }
    return true;
  }
}

export class InstrumentedConnectionPool<T> extends ConnectionPool<T> {
  activeGauge: Gauge.Internal;
  useTimeHistogram: Histogram.Internal;
  acquireErrorsCounter: Counter.Internal;
  pool: Pool<T>;
  acquireTimeHistogram: Histogram.Internal;
  options: ConnectionPoolOptions;
  constructor(factory: Factory<T>, options: ConnectionPoolOptions) {
    super();
    this.options = options;
    const labels = [options.name, options.readonly ? 'true' : 'false'];
    const instrumentedFactory = new InstrumentedFactory<T>(factory, options);
    this.pool = createPool(instrumentedFactory, this.getGenericPoolOptions());
    this.acquireTimeHistogram = acquireTimeHistogram.labels(...labels);
    this.acquireErrorsCounter = acquireErrorsCounter.labels(...labels);
    this.useTimeHistogram = useTimeHistogram.labels(...labels);
    this.activeGauge = activeGauge.labels(...labels);
  }
  async getConnection(): Promise<T> {
    const timer = this.acquireTimeHistogram.startTimer();
    try {
      const connection = await this.pool.acquire();
      connection['__useTimer'] = this.useTimeHistogram.startTimer();
      this.activeGauge.inc();
      return connection;
    } catch (e) {
      this.acquireErrorsCounter.inc();
      throw e;
    } finally {
      timer();
    }
  }
  private getGenericPoolOptions(): Options {
    return {}; //TODO implement
  }
  release(connection: T) {
    this.activeGauge.dec();
    if (connection['__useTimer']) {
      connection['__useTimer']();
    }
    this.pool.release(connection);
  }
  async start() {
    this.pool.start();
  }
  async stop() {
    throw new Error("Method not implemented.");
  }
}
