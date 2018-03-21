import * as pg from 'pg';
import { DBClient } from '../db/DBClient';
import { DBTransaction } from '../db/DBTransaction';
import { ConnectionPool } from '../db/ConnectionPool';
import { ConfigurationObject, PoolConfig } from '../db/ConfigurationObject';
import { Transaction, TransactionManager } from '../transaction/TransactionManager';
import { PromiseUtil } from '../util/PromiseUtil';
import { LogManager } from '../log/LogManager';

const log = LogManager.getLogger(__filename);

export class PostgresTransaction extends DBTransaction {
  postgresClient: PostgresClient;
  connection: pg.Client;

  /**
   *
   * @param {PostgresClient} postgresClient
   * @param transaction
   */
  constructor(postgresClient: PostgresClient, transaction: Transaction) {
    super(transaction);
    this.postgresClient = postgresClient;
  }

  // tslint:disable-next-line:prefer-function-over-method
  // tslint:disable-next-line:prefer-function-over-method
  runQueryOnPool(connection: pg.Client, sql: string, bindsArr: Array<any>): Promise<any> {
    log.debug(`sql: ${sql} ${(bindsArr && (bindsArr.length > 0)) ? `| ${bindsArr}` : ''}`);
    if (!Array.isArray(bindsArr)) {
      bindsArr = [];
    }

    return new Promise<any>((resolve, reject) =>
      connection.query(sql, bindsArr, (err, res) => {
        if (err) {
          log.error({ err }, `SQL error for ${sql}`);
          return reject(err);
        }
        return resolve(res.rows);
      }),
    );
  }

  protected async runQueryPrivate(sql: string, bindsArr: any[]): Promise<any> {
    if (!this.connection) {
      const pool = this.postgresClient.getConnectionPoolForReadonly(this.transaction.isReadonly());
      // tslint:disable-next-line:no-invalid-this
      this.connection = await pool.getConnection();
    }
    return await this.runQueryOnPool(this.connection, `/* Transaction Id ${this.transaction.id} */ ${sql}`, bindsArr);
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

class PostgresConnectionPool implements ConnectionPool<pg.Client> {

  instance: pg.Pool;
//   active: number;
//   numConnections: number;
//   enqueueTimes: Array<number>;
//   durationHistogram: any; // todo
//   config: PostgresPoolConfig;

  constructor(config: PostgresPoolConfig, name: string) {
    this.instance = new pg.Pool(config);
  }

  end() {
    return this.instance.end();
  }
  async getConnection() {
    return this.instance.connect();
  }
}

export interface PostgresPoolConfig extends PoolConfig {
 // TODO

}

export interface PostgresConfigurationObject extends ConfigurationObject<PostgresPoolConfig> {
}

/**
 * A MySQL client you can use to execute queries against MySQL
 */
export class PostgresClient extends DBClient {
  static startMethod = 'initialise';
  static stopMethod = 'shutdown';

  configuration: PostgresConfigurationObject;
  name: string;
  masterPool: ConnectionPool<pg.Client>;
  slavePool: ConnectionPool<pg.Client>;
  connectionPoolCreator: (config: PostgresPoolConfig) => ConnectionPool<pg.Client>;

  constructor() {
    super();
    this.configuration = {};
    this.name = 'NotSet';
    this.masterPool = null;
    this.slavePool = null;
    this.connectionPoolCreator = (config: PostgresPoolConfig) => new PostgresConnectionPool(config, this.name);
  }
  // configuration and name are two properties set by MysqlConfigManager
  initialise() {
    if (this.configuration.master) {
      this.masterPool = this.connectionPoolCreator(this.getFullPoolConfig(this.configuration.master));
    }
    if (this.configuration.slave) {
      this.slavePool = this.connectionPoolCreator(this.getFullPoolConfig(this.configuration.slave));
    }
    if (!this.masterPool && !this.slavePool) {
      throw new Error(`PostgresClient ${this.name} has no connections configured for either master or slave`);
    }
  }

  /**
   * Runs a function in a transaction. The function must receive one parameter that will be of class
   * {PostgresTransaction} and that you need to use to run all queries in this transaction
   *
   * @param {boolean} readonly Whether the transaction needs to be readonly or not
   * @param {Function} func A function that returns a promise that will execute all the queries wanted in this transaction
   * @returns {Promise} A promise that will execute the whole transaction
   */
  public runInTransaction(readonly: boolean, func: (transaction: PostgresTransaction) => Promise<any>): Promise<any> {
    const transaction = TransactionManager.newTransaction(readonly);
    const mysqlTransaction = new PostgresTransaction(this, transaction);
    return mysqlTransaction.begin()
      .then(() => func(mysqlTransaction))
      .catch((err) => {
        log.error({ err }, 'There was an error running in transaction');
        transaction.markError(err);
        throw err;
      })
      .then((result) => {
        mysqlTransaction.end();
        return result;
      }, (reason) => {
        mysqlTransaction.end();
        throw reason;
      });
  }

  async read<T>(sql: string, ...binds: any[]): Promise<T[]> {
    return this.runInTransaction(true, (client) => client.query(sql, ...binds));
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
  getFullPoolConfig(partial: PostgresPoolConfig): PostgresPoolConfig {
    const full = {
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: '',
      max: 10,
      min: 1,
    };
    Object.assign(full, partial);
    return full;
  }

  getConnectionPoolForReadonly(readonly: Boolean): ConnectionPool<pg.Client> {
    if (readonly && this.slavePool) {
      return this.slavePool;
    } else if (this.masterPool) {
      return this.masterPool;
    }
    throw new Error('Couldn\'t find an appropriate connection pool');
  }
}

// export const TestUtil = { runQueryOnPool };
