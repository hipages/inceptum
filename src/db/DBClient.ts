import { DBTransaction } from './DBTransaction';


export abstract class DBClient {
  /**
   * Runs a function in a transaction. The function must receive one parameter that will be of class
   * {MysqlTransaction} and that you need to use to run all queries in this transaction
   *
   * @param {boolean} readonly Whether the transaction needs to be readonly or not
   * @param {Function} func A function that returns a promise that will execute all the queries wanted in this transaction
   * @returns {Promise} A promise that will execute the whole transaction
   */
  public abstract runInTransaction(readonly: boolean, func: (transaction: DBTransaction) => Promise<any>): Promise<any>;

  /**
   * Shorthand for a single readonly query
   * @param sql query to run
   * @param binds binds
   */
  public abstract read(sql: string, ...binds: any[]): Promise<any[]>;
}
