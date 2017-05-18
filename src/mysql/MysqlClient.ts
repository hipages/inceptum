import * as mysql from 'mysql';
import { PromiseUtil } from '../util/PromiseUtil';
import LogManager from '../log/LogManager';
import { Transaction, TransactionManager } from '../transaction//TransactionManager';
import { MetricsService } from '../metrics/Metrics';
const log = LogManager.getLogger();

function runQueryOnPool(connection: mysql.IConnection, sql: string, bindsArr: Array<any>): Promise<any> {
  // console.log(sql);
  log.debug(`sql: ${sql} ${(bindsArr && (bindsArr.length > 0)) ? `| ${bindsArr}` : ''}`);
  if (!Array.isArray(bindsArr)) {
    bindsArr = [];
  }

  return new Promise((resolve, reject) =>
    connection.query(sql, bindsArr, (err, rows) => {
      if (err) {
        log.error({ err }, `SQL error for ${sql}`);
        return reject(err);
      }
      return resolve(rows);
    })
  );
}

function getConnectionPromise(connectionPool: mysql.IPool): Promise<mysql.IConnection> {
  return new Promise((resolve, reject) => {
    connectionPool.getConnection((err, connection) => {
      if (err) {
        reject(err);
      } else {
        resolve(connection);
      }
    });
  });
}

function runQueryPrivate(sql: string, bindsArr: Array<any>): Promise<any> {
  return PromiseUtil.try(() => {
    if (!this.connection) {
      return getConnectionPromise(this.mysqlClient.getConnectionPoolForReadonly(this.transaction.isReadonly()));
    }
    return this.connection;
  })
    .then((connection) => { this.connection = connection; return connection; })
    .then((connection) => runQueryOnPool(connection, `/* Transaction Id ${this.transaction.id} */ ${sql}`, bindsArr));
}



class MysqlTransaction {

  mysqlClient: MysqlClient;
  transaction: Transaction;

  /**
   *
   * @param {MysqlClient} myslqClient
   * @param transaction
   */
  constructor(mysqlClient: MysqlClient, transaction: Transaction) {
    this.mysqlClient = mysqlClient;
    this.transaction = transaction;
  }

  begin() {
    return runQueryPrivate.call(this, 'BEGIN')
      .then(() => {
        this.transaction.begin();
        this.transaction.addCommitListener(() => runQueryPrivate.call(this, 'COMMIT'));
        this.transaction.addRollbackListener(() => runQueryPrivate.call(this, 'ROLLBACK'));
      });
  }

  query(sql: string, ...bindArrs: any[]) {
    return runQueryPrivate.call(this, sql, bindArrs);
  }

  end(): void {
    this.transaction.end()
  }

}

interface ConnectionPool {
  getConnection(cb: (err: Error, connection: mysql.IConnection) => void): void;
  end(): void
}

class MetricsAwareConnectionPoolWrapper implements ConnectionPool {

  instance: mysql.IPool;
  active: number;
  numConnections: number;
  enqueueTimes: Array<number>;
  durationHistogram: any; // todo
  config: mysql.IPoolConfig

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

interface ConfigurationObject {
  enable57Mode?: boolean,
  master?: mysql.IPoolConfig,
  slave?: mysql.IPoolConfig
}

/**
 * A MySQL client you can use to execute queries against MySQL
 */
export class MysqlClient {

  static startMethod;
  static stopMethod;

  configuration: ConfigurationObject;
  name: string;
  masterPool: ConnectionPool;
  slavePool: ConnectionPool;
  enable57Mode: boolean;
  connectionPoolCreator: (config: mysql.IPoolConfig) => ConnectionPool;

  constructor() {
    this.configuration = {};
    this.name = 'NotSet';
    this.masterPool = null;
    this.slavePool = null;
    this.enable57Mode = false;
    this.connectionPoolCreator = (config: mysql.IPoolConfig) => new MetricsAwareConnectionPoolWrapper(mysql.createPool(config), this.name);
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
  runInTransaction(readonly: boolean, func: (transaction: MysqlTransaction) => Promise<any>) {
    const transaction = TransactionManager.newTransaction(readonly);
    const mysqlTransaction = new MysqlTransaction(this, transaction);
    return mysqlTransaction.begin()
      .then(() => func(mysqlTransaction))
      .catch((err) => {
        log.error({ err }, 'There was an error running in transaction');
        transaction.markError(err);
        throw err;
      })
      .finally((result) => {
        mysqlTransaction.end()
        return Promise.resolve(result); // TODO This weird?
      });
  }

  shutdown() {
    if (this.masterPool) {
      this.masterPool.end();
    }
    if (this.slavePool) {
      this.slavePool.end();
    }
  }
  getFullPoolConfig(partial: mysql.IPoolConfig): mysql.IPoolConfig {
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
      connectTimeout: 3000 // 3 seconds should be more than enough
    };
    Object.assign(full, partial);
    return full;
  }

  getConnectionPoolForReadonly(readonly: boolean): ConnectionPool {
    if (readonly && this.slavePool) {
      return this.slavePool;
    } else if (this.masterPool) {
      return this.masterPool;
    }
    throw new Error('Couldn\'t find an appropriate connection pool');
  }
}

MysqlClient.startMethod = 'initialise';
MysqlClient.stopMethod = 'shutdown';

export const TestUtil = { runQueryOnPool };
