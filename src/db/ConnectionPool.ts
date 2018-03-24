import { Summary, Gauge, Counter, register, Histogram } from 'prom-client';
import { createPool, Pool, Factory, Options } from 'generic-pool';
import { PoolConfig, DEFAULT_CONNECTION_POOL_OPTIONS, ConnectionConfig } from './DBClient';

export abstract class ConnectionPool<T> {
  abstract getName(): string;
  abstract isReadonly(): boolean;
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

async function promisify<T>(promiseLike: PromiseLike<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {promiseLike.then(resolve, reject);});
}

export class InstrumentedFactory<T> implements Factory<T> {
  connectErrorsCounter: Counter.Internal;
  connectTimeHistogram: Histogram.Internal;
  factory: Factory<T>;
  constructor(factory: Factory<T>, name: string, readonly: boolean) {
    this.factory = factory;
    const labels = [name, readonly ? 'true' : 'false'];
    this.connectTimeHistogram = connectTimeHistogram.labels(...labels);
    this.connectErrorsCounter = connectErrorsCounter.labels(...labels);
  }
  async create(): Promise<T> {
    const timer = this.connectTimeHistogram.startTimer();
    try {
      return await promisify(this.factory.create());
    } catch (e) {
      this.connectErrorsCounter.inc();
      throw e;
    } finally {
      timer();
    }
  }
  async destroy(client: T): Promise<undefined> {
    return await promisify(this.factory.destroy(client));
  }
  async validate(client: T): Promise<boolean> {
    if (this.factory.validate) {
      return await promisify(this.factory.validate(client));
    }
    return true;
  }
}

export class InstrumentedConnectionPool<C, CC extends ConnectionConfig> extends ConnectionPool<C> {
  readonly: boolean;
  name: string;
  activeGauge: Gauge.Internal;
  useTimeHistogram: Histogram.Internal;
  acquireErrorsCounter: Counter.Internal;
  pool: Pool<C>;
  acquireTimeHistogram: Histogram.Internal;
  options: PoolConfig<CC>;

  constructor(factory: Factory<C>, options: PoolConfig<CC>, name: string, readonly: boolean) {
    super();
    this.name = name;
    this.readonly = readonly;
    this.options = {...DEFAULT_CONNECTION_POOL_OPTIONS, ...options};
    const labels = [name, readonly ? 'true' : 'false'];
    const instrumentedFactory = new InstrumentedFactory<C>(factory, name, readonly);
    this.pool = createPool(instrumentedFactory, this.getGenericPoolOptions());
    this.acquireTimeHistogram = acquireTimeHistogram.labels(...labels);
    this.acquireErrorsCounter = acquireErrorsCounter.labels(...labels);
    this.useTimeHistogram = useTimeHistogram.labels(...labels);
    this.activeGauge = activeGauge.labels(...labels);
  }
  getName(): string {
    return this.name;
  }
  isReadonly(): boolean {
    return this.readonly;
  }
  async getConnection(): Promise<C> {
    const timer = this.acquireTimeHistogram.startTimer();
    try {
      const connection = await promisify(this.pool.acquire());
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
    return {
      acquireTimeoutMillis: this.options.acquireTimeoutMillis,
      autostart: false,
      evictionRunIntervalMillis: this.options.evictionRunIntervalMillis,
      fifo: false,
      idleTimeoutMillis: this.options.idleTimeoutMillis,
      max: this.options.max,
      maxWaitingClients: this.options.maxWaitingClients,
      min: this.options.min,
      numTestsPerRun: this.options.numTestsPerRun,
      softIdleTimeoutMillis: this.options.softIdleTimeoutMillis,
      testOnBorrow: this.options.testOnBorrow,
    };
  }
  release(connection: C) {
    this.activeGauge.dec();
    if (connection['__useTimer']) {
      connection['__useTimer']();
    }
    this.pool.release(connection);
  }
  async start() {
    await this.pool['start']();
  }
  async stop() {
    await promisify(this.pool.drain());
    await promisify(this.pool.clear());
  }
  getOptions(): PoolConfig<CC> {
    return {... this.options};
  }
}
