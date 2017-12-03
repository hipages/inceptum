import * as mysql from 'mysql';
import { DBTransaction } from '../db/DBTransaction';
import { ConnectionPool } from '../db/ConnectionPool';
import { ConfigurationObject, PoolConfig } from '../db/ConfigurationObject';
import { Transaction, TransactionManager } from '../transaction/TransactionManager';
import { PromiseUtil } from '../util/PromiseUtil';
import { LogManager } from '../log/LogManager';
import { Histogram, MetricsService } from '../metrics/Metrics';
import { DBClient } from '../db/DBClient';

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
  private getConnectionPromise(connectionPool: ConnectionPool<mysql.IConnection>): Promise<mysql.IConnection> {
    return new Promise<any>((resolve, reject) => {
      connectionPool.getConnection((err, connection) => {
        if (err) {
          reject(err);
        } else {
          resolve(connection);
        }
      });
    });
  }

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

  protected runQueryPrivate(sql: string, bindsArr: any[]): Promise<any> {
    return PromiseUtil.try(() => {
      // tslint:disable-next-line:no-invalid-this
      if (!this.connection) {
        // tslint:disable-next-line:no-invalid-this
        return this.getConnectionPromise(this.mysqlClient.getConnectionPoolForReadonly(this.transaction.isReadonly()));
      }
      // tslint:disable-next-line:no-invalid-this
      return this.connection;
    })
    // tslint:disable-next-line:no-invalid-this
    .then((connection) => { this.connection = connection; return connection; })
    // tslint:disable-next-line:no-invalid-this
    .then((connection) => this.runQueryOnPool(`/* Transaction Id ${this.transaction.id} */ ${sql}`, bindsArr));
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
    this.connection.release();
  }
}

class MetricsAwareConnectionPoolWrapper implements ConnectionPool<mysql.IConnection> {

  instance: mysql.IPool;
  active: number;
  numConnections: number;
  enqueueTimes: Array<number>;
  durationHistogram: any; // todo
  config: MySQLPoolConfig;

  constructor(instance: mysql.IPool, name: string) {
    this.instance = instance;
    this.active = 0;
    this.numConnections = 0;
    this.enqueueTimes = [];
    this.setupPool();
    this.durationHistogram = MetricsService.histogram(`db_pool_${name}`);
  }

  setupPool() {
    const self = this;
    if (this.instance.on) {
      this.instance.on('acquire', () => {
        self.active++;
        if (this.enqueueTimes.length > 0) {
          const start = this.enqueueTimes.shift();
          self.registerWaitTime(Date.now() - start);
        }
      });
      this.instance.on('connection', () => { self.numConnections++; });
      this.instance.on('enqueue', () => {
        this.enqueueTimes.push(Date.now());
      });
      this.instance.on('release', () => {
        this.active--;
      });
    }
  }
  registerWaitTime(duration) {
    this.durationHistogram.observe(duration);
  }
  end() {
    return this.instance.end();
  }
  getConnection(cb) {
    this.instance.getConnection((err, connection) => {
      cb(err, connection);
    });
  }
}

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

}

export interface MySQLConfigurationObject extends ConfigurationObject<MySQLPoolConfig> {
  enable57Mode?: boolean,
}

/**
 * A MySQL client you can use to execute queries against MySQL
 */
export class MysqlClient extends DBClient {
  static startMethod = 'initialise';
  static stopMethod = 'shutdown';

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
    this.connectionPoolCreator = (config: MySQLPoolConfig) => new MetricsAwareConnectionPoolWrapper(mysql.createPool(config), this.name);
  }
  // configuration and name are two properties set by MysqlConfigManager
  initialise() {
    this.enable57Mode = this.configuration.enable57Mode || false;
    if (this.configuration.master) {
      this.masterPool = this.connectionPoolCreator(this.getFullPoolConfig(this.configuration.master));
    }
    if (this.configuration.slave) {
      this.slavePool = this.connectionPoolCreator(this.getFullPoolConfig(this.configuration.slave));
    }
    if (!this.masterPool && !this.slavePool) {
      throw new Error(`MysqlClient ${this.name} has no connections configured for either master or slave`);
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

    try {
      await mysqlTransaction.begin();
      const resp = await func(mysqlTransaction);
      await mysqlTransaction.end();
      return resp;
    } catch (err) {
      log.error({ err }, 'There was an error running in transaction');
      transaction.markError(err);
      await mysqlTransaction.end();
      throw err;
    }


    // return mysqlTransaction.begin()
    //   .then(async () => await func(mysqlTransaction))
    //   .catch((err) => {
    //     log.error({ err }, 'There was an error running in transaction');
    //     transaction.markError(err);
    //     throw err;
    //   })
    //   .then(async (result) => {
    //     await mysqlTransaction.end();
    //     return result;
    //   }, async (reason) => {
    //     await mysqlTransaction.end();
    //     throw reason;
    //   });


      // .finally((result) => {
      //   mysqlTransaction.end();
      //   return Promise.resolve(result); // TODO This weird?
      // });
  }

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
}

// export const TestUtil = { runQueryOnPool };
