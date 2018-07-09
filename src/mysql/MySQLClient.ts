import * as mysql from 'mysql';
import { createPool, Pool, Factory, Options } from 'generic-pool';
import { DBTransaction } from '../db/DBTransaction';
import { ConnectionPool, PoolConfig, ConnectionConfig } from '../db/ConnectionPool';
import { Transaction } from '../transaction/TransactionManager';
import { LogManager } from '../log/LogManager';
import { DBClient, DBClientConfig } from '../db/DBClient';

const LOGGER = LogManager.getLogger(__filename);
const MARKED_FOR_DELETION = 'MARKED_FOR_DELETION';

/**
 * CONFIGURATION OBJECTS
 */

export interface MySQLConnectionConfig extends ConnectionConfig {
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

export interface MySQLClientConfiguration extends DBClientConfig<MySQLConnectionConfig> {
  enable57Mode?: boolean,
}


export class MySQLTransaction extends DBTransaction<mysql.IConnection> {
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
  getTransactionBeginSQL(): string {
    return (this.isReadonly()) ? 'START TRANSACTION READ ONLY' : 'START TRANSACTION READ WRITE';
  }
}

class MySQLConnectionFactory implements Factory<mysql.IConnection> {
  name: string;
  connConfig: mysql.IConnectionConfig;
  constructor(name: string, connectionConfig: MySQLConnectionConfig) {
    this.connConfig = connectionConfig;
    this.name = name;
  }

  create(): Promise<mysql.IConnection> {
    LOGGER.trace(`Creating new connection for pool ${this.name}`);
    const connection = mysql.createConnection(this.connConfig);

    /*
    * There isnt any good reason why a connection should ever error, so we mark any connection
    * that throws as error as bad, the pool will then check before giving this connection back out
    * and throw it away.
    */
    connection.on('error', (error) => {
      LOGGER.error('Connection errored:', error);
      connection[MARKED_FOR_DELETION] = true;
    });

    return new Promise((resolve, reject) => connection.connect((err) => {
      if (err) {
        reject(err);
      } else {
        resolve(connection);
      }
    }));
  }

  destroy(connection: mysql.IConnection): Promise<undefined> {
    LOGGER.trace(`Destroying connection for pool ${this.name}`);
    return new Promise((resolve, reject) => {
      connection.end((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async validate(connection: mysql.IConnection): Promise<boolean> {
    LOGGER.trace(`Validating connection for pool ${this.name}`);
    return !connection[MARKED_FOR_DELETION];
  }
}

/**
 * A MySQL client you can use to execute queries against MySQL
 */
export class MySQLClient extends DBClient<mysql.IConnection, MySQLTransaction, MySQLConnectionConfig, MySQLClientConfiguration> {
  enable57Mode: boolean;

  constructor(clientConfig: MySQLClientConfiguration) {
    super(clientConfig);
    this.enable57Mode = false;
  }

  async initialise() {
    this.enable57Mode = this.clientConfiguration.enable57Mode || false;
    await super.initialise();
  }

  getConnectionFactory(name: string, connectionConfig: MySQLConnectionConfig): Factory<mysql.IConnection> {
    return new MySQLConnectionFactory(name, connectionConfig);
  }

  getNewDBTransaction(readonly: boolean, connectionPool: ConnectionPool<mysql.IConnection>): MySQLTransaction {
    return new MySQLTransaction(this.clientConfiguration.name, readonly, connectionPool);
  }

  getPingQuery(): string {
    return 'SELECT 1';
  }

  getDefaultConnectionConfig(): MySQLConnectionConfig {
    return {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: '',
      charset: 'UTF8',
    };
  }

}
