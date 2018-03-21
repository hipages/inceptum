import * as mysql from 'mysql';
import { Summary, Gauge, Counter, register, Histogram } from 'prom-client';
import { DBTransaction } from '../db/DBTransaction';
import { ConnectionPool } from '../db/ConnectionPool';
import { ConfigurationObject, PoolConfig } from '../db/ConfigurationObject';
import { Transaction, TransactionManager } from '../transaction/TransactionManager';
import { PromiseUtil } from '../util/PromiseUtil';
import { LogManager } from '../log/LogManager';
import { DBClient } from '../db/DBClient';
import { StartMethod, StopMethod } from '../ioc/Decorators';
import MysqlConnectionPool from './MysqlConnectionPool';

const log = LogManager.getLogger(__filename);


export class MysqlTransaction extends DBTransaction {
  mysqlClient: MysqlClient;
  connection: mysql.IConnection;

  /**
   *
   * @param {MysqlClient} myslqClient
   * @param transaction
   */
  constructor(mysqlClient: MysqlClient, transaction: Transaction) {
    super(transaction);
    this.mysqlClient = mysqlClient;
  }

  // tslint:disable-next-line:prefer-function-over-method

  runQueryOnPool(sql: string, bindsArr: Array<any>): Promise<any> {
    log.debug(`sql: ${sql} ${(bindsArr && (bindsArr.length > 0)) ? `| ${bindsArr}` : ''}`);
    if (!Array.isArray(bindsArr)) {
      bindsArr = [];
    }
    return new Promise<any>((resolve, reject) =>
      this.connection.query(sql, bindsArr, (err, rows) => {
        if (err) {
          log.error({ err }, `SQL error for ${sql}`);
          return reject(err);
        }
        return resolve(rows);
      }),
    );
  }

  protected async runQueryPrivate(sql: string, bindsArr: any[]): Promise<any> {
    if (!this.connection) {
      const pool  = this.mysqlClient.getConnectionPoolForReadonly(this.transaction.isReadonly());
      this.connection = await pool.getConnection();
    }
    return this.runQueryOnPool(`/* Transaction Id ${this.transaction.id} */ ${sql}`, bindsArr);
}


  public runQueryAssocPrivate(sql: string, bindsObj: object): Promise<any> {
    if (sql.indexOf('::') < 0 || !bindsObj) {
      // tslint:disable-next-line:no-invalid-this
      return this.runQueryPrivate.call(this, sql, []);
    }
    sql.replace(/::(\w)+::/g, (substr, key) => {
      if (bindsObj.hasOwnProperty(key)) {
        return bindsObj[key];
      }
      return substr;
    });
  }

  async doTransactionEnd(): Promise<void> {
    if (this.connection) {
      this.connection.release();
    }
  }
}

const transactionExecutionDurationsHistogram = new Histogram({
  name: 'db_transaction_execute_time',
  help: 'Time required to execute a transaction',
  labelNames: ['poolName', 'readonly'],
  buckets: [0.003, 0.005, 0.01, 0.05, 0.1, 0.3, 1, 5]});

export interface MySQLPoolConfig extends PoolConfig {

  /**
   * The source IP address to use for TCP connection
   */
  localAddress?: string,

  /**
   * The path to a unix domain socket to connect to. When used host and port are ignored
   */
  socketPath?: string,

  /**
   * The timezone used to store local dates. (Default: 'local')
   */
  timezone?: string,

  /**
   * object with ssl parameters or a string containing name of ssl profile
   */
  ssl?: any,

  /**
   * The milliseconds before a timeout occurs during the connection acquisition. This is slightly different from connectTimeout,
   * because acquiring a pool connection does not always involve making a connection. (Default: 10 seconds)
   */
  acquireTimeout?: number,

  /**
   * Determines the pool's action when no connections are available and the limit has been reached. If true, the pool will queue
   * the connection request and call it when one becomes available. If false, the pool will immediately call back with an error.
   * (Default: true)
   */
  waitForConnections?: boolean,

  /**
   * The maximum number of connections to create at once. (Default: 10)
   */
  connectionLimit?: number,

  /**
   * The maximum number of connection requests the pool will queue before returning an error from getConnection. If set to 0, there
   * is no limit to the number of queued connection requests. (Default: 0)
   */
  queueLimit?: number,

  /**
   * The number of requests to do during startup to warm up the pool of connections. This will happen during the StartUp phase of the
   * object. This means that it will increase the startup time. All the requests are fired in parallel so that the pool will request
   * as many connections, instead of simply returning the same connection multiple times. (Default: 3 or connectionLimit, whichever is less).
   * Use 0 to disable
   */
  warmupRequests?: number,
}

export interface MySQLConfigurationObject extends ConfigurationObject<MySQLPoolConfig> {
  enable57Mode?: boolean,
}

/**
 * A MySQL client you can use to execute queries against MySQL
 */
export class MysqlClient extends DBClient {

  configuration: MySQLConfigurationObject;
  name: string;
  masterPool: ConnectionPool<mysql.IConnection>;
  slavePool: ConnectionPool<mysql.IConnection>;
  enable57Mode: boolean;
  connectionPoolCreator: (config: MySQLPoolConfig) => ConnectionPool<mysql.IConnection>;

  constructor() {
    super();
    this.configuration = {};
    this.name = 'NotSet';
    this.masterPool = null;
    this.slavePool = null;
    this.enable57Mode = false;
    this.connectionPoolCreator = (config: MySQLPoolConfig) => new MysqlConnectionPool(config, this.name);
  }
  // configuration and name are two properties set by MysqlConfigManager
  @StartMethod
  async initialise() {
    this.enable57Mode = this.configuration.enable57Mode || false;
    if (this.configuration.master) {
      const fullMasterConfig = this.getFullPoolConfig(this.configuration.master);
      this.masterPool = this.connectionPoolCreator(fullMasterConfig);
      if (fullMasterConfig.warmupRequests && fullMasterConfig.warmupRequests > 0) {
        log.debug(`Warming up master connection pool for ${this.name} (${fullMasterConfig.warmupRequests} requests)`);
        await this.warmupPool(this.masterPool, fullMasterConfig);
      }
    }
    if (this.configuration.slave) {
      const fullSlaveConfig = this.getFullPoolConfig(this.configuration.slave);
      this.slavePool = this.connectionPoolCreator(fullSlaveConfig);
      if (fullSlaveConfig.warmupRequests && fullSlaveConfig.warmupRequests > 0) {
        log.debug(`Warming up slave connection pool for ${this.name} (${fullSlaveConfig.warmupRequests} requests)`);
        await this.warmupPool(this.slavePool, fullSlaveConfig);
      }
    }
    if (!this.masterPool && !this.slavePool) {
      throw new Error(`MysqlClient ${this.name} has no connections configured for either master or slave`);
    }
  }

  private async warmupPool(connectionPool: ConnectionPool<mysql.IConnection>, poolConfig: MySQLPoolConfig) {
    if (poolConfig.warmupRequests && poolConfig.warmupRequests > 0) {
      const effectiveNumber = poolConfig.warmupRequests <= poolConfig.connectionLimit ? poolConfig.warmupRequests : poolConfig.connectionLimit;
      const requests = [];
      for (let i = 0; i < effectiveNumber; i++) {
        connectionPool.getConnection().then(conn => conn.release());
      }
      await Promise.all(requests);
    }
  }

  /**
   * Runs a function in a transaction. The function must receive one parameter that will be of class
   * {MysqlTransaction} and that you need to use to run all queries in this transaction
   *
   * @param {boolean} readonly Whether the transaction needs to be readonly or not
   * @param {Function} func A function that returns a promise that will execute all the queries wanted in this transaction
   * @returns {Promise} A promise that will execute the whole transaction
   */
  async runInTransaction(readonly: boolean, func: (transaction: DBTransaction) => Promise<any>): Promise<any> {
    const transaction = TransactionManager.newTransaction(readonly);
    const mysqlTransaction = new MysqlTransaction(this, transaction);

    const timer = transactionExecutionDurationsHistogram.labels(this.name, readonly ? 'true' : 'false').startTimer();
    try {
      await mysqlTransaction.begin();
      const resp = await func(mysqlTransaction);
      return resp;
    } catch (err) {
      log.error({ err }, 'There was an error running in transaction');
      transaction.markError(err);
      throw err;
    } finally {
      await mysqlTransaction.end();
      timer();
    }
  }

  async read<T>(sql: string, ...binds: any[]): Promise<T[]> {
    return this.runInTransaction(true, (client) => client.query(sql, ...binds));
  }

  @StopMethod
  shutdown() {
    if (this.masterPool) {
      this.masterPool.end();
    }
    if (this.slavePool) {
      this.slavePool.end();
    }
  }
  // tslint:disable-next-line:prefer-function-over-method
  getFullPoolConfig(partial: MySQLPoolConfig): MySQLPoolConfig {
    const full = {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      charset: 'utf8',
      connectionLimit: 10,
      acquireTimeout: 1000, // 1 second
      waitForConnections: true,
      queueLimit: 10,
      connectTimeout: 3000, // 3 seconds should be more than enough
      warmupRequests: 3, // How many requests to do on startup so that the pool is a bit warm
    };
    Object.assign(full, partial);
    return full;
  }

  getConnectionPoolForReadonly(readonly: Boolean): ConnectionPool<mysql.IConnection> {
    if (readonly && this.slavePool) {
      return this.slavePool;
    } else if (this.masterPool) {
      return this.masterPool;
    }
    throw new Error('Couldn\'t find an appropriate connection pool');
  }

  async ping(readonly: boolean): Promise<void> {
    log.debug('Doing ping');
    const pool = this.getConnectionPoolForReadonly(readonly);
    const connection = await pool.getConnection();
    log.debug('Got connection for ping');
    return new Promise<void>((resolve, reject) => connection.query('SELECT 1', (err, res) => {
      log.debug('Result from select');
      connection.release();
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    }));
  }
}