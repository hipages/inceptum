import { Client } from 'pg';
import { Factory } from 'generic-pool';
import { DBClient, ConnectionConfig, DBClientConfig } from '../db/DBClient';
import { DBTransaction } from '../db/DBTransaction';
import { ConnectionPool } from '../db/ConnectionPool';
import { Transaction } from '../transaction/TransactionManager';
import { PromiseUtil } from '../util/PromiseUtil';
import { LogManager } from '../log/LogManager';

const LOGGER = LogManager.getLogger(__filename);

/**
 * CONFIGURATION OBJECTS
 */

export interface PostgresConnectionConfig extends ConnectionConfig {
  /**
   * number of milliseconds before a query will time out default is no timeout
   */
  statement_timeout?: number,

  /**
   * The hostname of the database you are connecting to. (Default: localhost)
   */
  host: string,

  /**
   * The port number to connect to. (Default: 3306)
   */
  port?: number,

  /**
   * Name of the database to connect to
   */
  database: string,

  /**
   * User used to connect
   */
  user: string,

  /**
   * Password used to authenticate on connection
   */
  password: string,

  /**
   * The milliseconds before a timeout occurs during the initial connection to the MySQL server. (Default: 10 seconds)
   */
  connectTimeout?: number,

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
   * The character set to use in the connection
   */
  charset?: string,
}

export interface PostgresClientConfiguration extends DBClientConfig<PostgresConnectionConfig> {
}

export class PostgresTransaction extends DBTransaction<Client> {
  protected runQueryInConnection(sql: string, bindsArr: Array<any>): Promise<any> {
    return new Promise<any>((resolve, reject) =>
      this.connection.query(sql, bindsArr, (err, rows) => {
        if (err) {
          LOGGER.error(err, `SQL error for ${sql}`);
          return reject(err);
        }
        return resolve(rows);
      }),
    );
  }
}

class PostgresConnectionFactory implements Factory<Client> {
  name: string;
  connConfig: PostgresConnectionConfig;
  constructor(name: string, connectionConfig: PostgresConnectionConfig) {
    this.connConfig = connectionConfig;
    this.name = name;
  }

  async create(): Promise<Client> {
    LOGGER.debug(`Creating new connection for pool ${this.name}`);
    const connection = new Client(this.connConfig);
    await new Promise<void>((resolve, reject) => connection.connect((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    }));
    return connection;
  }
  async destroy(connection: Client): Promise<undefined> {
    LOGGER.debug(`Destroying connection for pool ${this.name}`);
    await new Promise<void>((resolve, reject) => connection.end((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    }));
    return undefined;
  }
  validate(connection: Client): PromiseLike<boolean> {
    LOGGER.debug(`Validating connection for pool ${this.name}`);
    return new Promise<boolean>((resolve, reject) => {
      connection.query('SELECT 1', (err, results) => {
        if (err) {
          resolve(false);
        }
        resolve(true);
      });
    });
  }
}

/**
 * A MySQL client you can use to execute queries against MySQL
 */
export class PostgresClient extends DBClient<Client, PostgresTransaction, PostgresConnectionConfig, PostgresClientConfiguration> {

  async initialise() {
    await super.initialise();
  }

  getConnectionFactory(name: string, connectionConfig: PostgresConnectionConfig): Factory<Client> {
    return new PostgresConnectionFactory(name, connectionConfig);
  }

  getNewDBTransaction(connectionPool: ConnectionPool<Client>): PostgresTransaction {
    return new PostgresTransaction(connectionPool);
  }
  getPingQuery(): string {
    return 'SELECT 1';
  }

  getDefaultConnectionConfig(): PostgresConnectionConfig {
    return {
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: '',
      database: '',
    };
  }
}
