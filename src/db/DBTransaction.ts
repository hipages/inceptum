
import { Summary, Gauge, Counter, register, Histogram } from 'prom-client';
import { Transaction } from '../transaction/TransactionManager';
import { LogManager } from '../log/LogManager';
import { ConnectionPool } from './ConnectionPool';

const LOGGER = LogManager.getLogger(__filename);

const transactionExecutionDurationsHistogram = new Histogram({
  name: 'db_transaction_execute_time',
  help: 'Time required to execute a transaction',
  labelNames: ['poolName', 'readonly'],
  buckets: [0.003, 0.005, 0.01, 0.05, 0.1, 0.3, 1, 5],
});
const rolledBackTransactionsCounter = new Counter({
  name: 'db_transaction_rollback_counter',
  help: 'Number of times transactions have been rolled back',
  labelNames: ['poolName', 'readonly'],
});

export abstract class DBTransaction<C> {
  protected connectionPool: ConnectionPool<C>;
  protected connection: C;
  protected transaction: Transaction;
  protected rolledBack = false;

  /**
   *
   * @param transaction
   */
  constructor(connectionPool: ConnectionPool<C>) {
    this.transaction = new Transaction();
    this.connectionPool = connectionPool;
  }

  /**
   * Executes a query in the current connection
   * @param sql The SQL to execute
   * @param bindsArr the list of parameters to pass to the query, or an empty array if there are no parameters
   */
  protected abstract runQueryInConnection(sql: string, bindsArr: Array<any>): Promise<any>;

  public async runQueryWithoutTransaction(sql: string, bindsArr?: Array<any>): Promise<any> {
    await this.obtainConnection();
    try {
      return await this.sanitizeAndRunQueryInConnection(sql, bindsArr);
    } finally {
      this.releaseConnection();
    }
  }

  getTransaction(): Transaction {
    return this.transaction;
  }

  async begin(): Promise<void> {
    await this.obtainConnection();
    await this.doTransactionBegin();
    this.transaction.begin();
    this.transaction.addCommitListener(() => this.doTransactionCommit());
    this.transaction.addRollbackListener(() => this.doTransactionRollback());
    this.transaction.addEndListener(() => this.releaseConnection());
  }

  private async obtainConnection() {
    this.connection = await this.connectionPool.getConnection();
  }

  query(sql: string, ...bindArrs: any[]): Promise<any> {
    return this.sanitizeAndRunQueryInConnection(sql, bindArrs);
  }

  queryAssoc(sql: string, bindObj: object): Promise<any> {
    return this.runQueryAssocPrivate(sql, bindObj);
  }

  markError(error: any) {
    this.transaction.markError(error);
  }

  sanitizeAndRunQueryInConnection(sql: string, bindsArr?: Array<any>): Promise<any> {
    LOGGER.debug(`sql: ${sql} ${(bindsArr && (bindsArr.length > 0)) ? `| ${bindsArr}` : ''}`);
    if (!Array.isArray(bindsArr)) {
      bindsArr = [];
    }
    return this.runQueryInConnection(`/* Transaction Id ${this.transaction.id} */ ${sql}`, bindsArr);
  }

  public runQueryAssocPrivate(sql: string, bindsObj: object): Promise<any> {
    if (sql.indexOf('::') < 0 || !bindsObj) {
      // tslint:disable-next-line:no-invalid-this
      return this.sanitizeAndRunQueryInConnection.call(this, sql, []);
    }
    sql.replace(/::(\w)+::/g, (substr, key) => {
      if (bindsObj.hasOwnProperty(key)) {
        return bindsObj[key];
      }
      return substr;
    });
  }

  doTransactionBegin(): Promise<void> {
    return this.sanitizeAndRunQueryInConnection(this.getTransactionBeginSQL());
  }

  // tslint:disable-next-line:prefer-function-over-method
  getTransactionBeginSQL(): string {
    return 'BEGIN';
  }

  doTransactionCommit(): Promise<void> {
    return this.sanitizeAndRunQueryInConnection(this.getTransactionCommitSQL());
  }

  // tslint:disable-next-line:prefer-function-over-method
  getTransactionCommitSQL(): string {
    return 'COMMIT';
  }

  doTransactionRollback(): Promise<void> {
    this.rolledBack = true;
    return this.sanitizeAndRunQueryInConnection(this.getTransactionRollbackSQL());
  }

  // tslint:disable-next-line:prefer-function-over-method
  getTransactionRollbackSQL(): string {
    return 'ROLLBACK';
  }

  async releaseConnection(): Promise<void> {
    if (this.connection) {
      this.connectionPool.release(this.connection);
      this.connection = null;
    }
  }

  async end(): Promise<void> {
    await this.transaction.end();
  }

  public isRolledBack(): boolean {
    return this.rolledBack;
  }
}
