import { Summary, Gauge, Counter, register, Histogram } from 'prom-client';
import { ExtendedGauge, ExtendedGaugeInternal } from 'prometheus-extended-gauge';
import { createPool, Pool, Factory, Options } from 'generic-pool';

/**
 * Sensible defaults for the connection pool options
 */
export const DEFAULT_CONNECTION_POOL_OPTIONS: PoolConfig<any> = {
  max: 10,
  min: 2,
  maxWaitingClients: 10,
  testOnBorrow: true,
  acquireTimeoutMillis: 1000,
  evictionRunIntervalMillis: 30000,
  numTestsPerRun: 2,
  idleTimeoutMillis: 30000,
};

/**
 * Base interface for the configuration information needed to create a new connection
 */
export interface ConnectionConfig { }

/**
 * Class for the config of a Pool.
 * This class is not supposed to be extended, as the framework does not expose methods to override the creation of the
 * connection pools.
 */
export interface PoolConfig<C extends ConnectionConfig> {
  max?: number,
  min?: number,
  maxWaitingClients?: number,
  testOnBorrow?: boolean,
  acquireTimeoutMillis?: number,
  evictionRunIntervalMillis?: number,
  numTestsPerRun?: number,
  softIdleTimeoutMillis?: number,
  idleTimeoutMillis?: number,
  connectionConfig?: C,
}

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
const validateFailedCounter = new Counter({
  name: 'db_pool_validate_failed_counter',
  help: 'Number of times a validation fails',
  labelNames: ['poolName', 'readonly'],
});
const activeGauge = new ExtendedGauge({
  name: 'db_pool_active_connections_gauge',
  help: 'Number of active connections in the pool',
  labelNames: ['poolName', 'readonly'],
  average: true,
  max: true,
  min: false,
  bucketSizeMillis: 1000,
  numBuckets: 60,
});
const totalGauge = new Gauge({
  name: 'db_pool_total_connections_gauge',
  help: 'Number of total connections in the pool',
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

export class InstrumentedFactory<T> implements Factory<T> {
  validateFailedCounter: Counter.Internal;
  connectErrorsCounter: Counter.Internal;
  connectTimeHistogram: Histogram.Internal;
  totalGauge: Gauge.Internal;
  factory: Factory<T>;
  constructor(factory: Factory<T>, name: string, readonly: boolean) {
    this.factory = factory;
    const labels = [name, readonly ? 'true' : 'false'];
    this.connectTimeHistogram = connectTimeHistogram.labels(...labels);
    this.connectErrorsCounter = connectErrorsCounter.labels(...labels);
    this.totalGauge = totalGauge.labels(...labels);
    this.validateFailedCounter = validateFailedCounter.labels(...labels);
  }
  async create(): Promise<T> {
    const timer = this.connectTimeHistogram.startTimer();
    try {
      const connection = await this.factory.create();
      this.totalGauge.inc();
      return connection;
    } catch (e) {
      this.connectErrorsCounter.inc();
      throw e;
    } finally {
      timer();
    }
  }
  async destroy(client: T): Promise<undefined> {
    try {
      return await this.factory.destroy(client);
    } finally {
      this.totalGauge.dec();
    }
  }
  async validate(client: T): Promise<boolean> {
    if (this.factory.validate) {
      const resp = await this.factory.validate(client);
      if (!resp) {
        this.validateFailedCounter.inc();
      }
      return resp;
    }
    return true;
  }
}

enum PoolStatus {
  NOT_STARTED,
  STARTED,
  STOPPED,
}

export class InstrumentedConnectionPool<C, CC extends ConnectionConfig> extends ConnectionPool<C> {
  readonly: boolean;
  name: string;
  activeGauge: ExtendedGaugeInternal;
  useTimeHistogram: Histogram.Internal;
  acquireErrorsCounter: Counter.Internal;
  pool: Pool<C>;
  acquireTimeHistogram: Histogram.Internal;
  options: PoolConfig<CC>;
  private status = PoolStatus.NOT_STARTED;

  constructor(factory: Factory<C>, options: PoolConfig<CC>, name: string, readonly: boolean) {
    super();
    this.name = name;
    this.readonly = readonly;
    this.options = { ...DEFAULT_CONNECTION_POOL_OPTIONS, ...options };
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
    if (this.status !== PoolStatus.STARTED) {
      throw new Error(`Can't acquire connections from connection pool ${this.name}. The pool is not started`);
    }
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
    if (this.status !== PoolStatus.NOT_STARTED) {
      throw new Error(`Can't start a connection pool that isn't in NOT_STARTED state. Pool: ${this.name}, Current Status: ${this.status}`);
    }
    this.status = PoolStatus.STARTED;
    await this.pool['start']();
    // The pool needs to get into a good state. Waiting a bit has proven a good solution.
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
  }

  async stop() {
    if (this.status !== PoolStatus.STARTED) {
      throw new Error(`Can't stop a connection pool that isn't in STARTED state. Pool: ${this.name}, Current Status: ${this.status}`);
    }
    this.status = PoolStatus.STOPPED;
    await this.pool.drain();
    await this.pool.clear();
  }
  getOptions(): PoolConfig<CC> {
    return { ... this.options };
  }
}
