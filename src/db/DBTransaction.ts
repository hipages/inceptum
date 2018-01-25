import { Transaction } from '../transaction/TransactionManager';

export abstract class DBTransaction {
  protected transaction: Transaction;
  protected rolledBack = false;

  /**
   *
   * @param transaction
   */
  constructor(transaction: Transaction) {
    this.transaction = transaction;
  }

  async begin(): Promise<void> {
    await this.doTransactionBegin();
    this.transaction.begin();
    this.transaction.addCommitListener(async () => await this.doTransactionCommit());
    this.transaction.addRollbackListener(async () => await this.doTransactionRollback());
    this.transaction.addEndListener(async () => await this.doTransactionEnd());
  }

  query(sql: string, ...bindArrs: any[]): Promise<any> {
    return this.runQueryPrivate(sql, bindArrs);
  }

  queryAssoc(sql: string, bindObj: object): Promise<any> {
    return this.runQueryAssocPrivate(sql, bindObj);
  }

  protected abstract runQueryPrivate(sql: string, bindArrs?: any[]): Promise<any>;
  protected abstract runQueryAssocPrivate(sql: string, bindObj?: object): Promise<any>;

  doTransactionBegin(): Promise<void> {
    return this.runQueryPrivate(this.getTransactionBeginSQL());
  }

  // tslint:disable-next-line:prefer-function-over-method
  getTransactionBeginSQL(): string {
    return 'BEGIN';
  }

  async doTransactionCommit(): Promise<void> {
    await this.runQueryPrivate(this.getTransactionCommitSQL());
  }

  // tslint:disable-next-line:prefer-function-over-method
  getTransactionCommitSQL(): string {
    return 'COMMIT';
  }

  async doTransactionRollback(): Promise<void> {
    this.rolledBack = true;
    await this.runQueryPrivate(this.getTransactionRollbackSQL());
  }

  // tslint:disable-next-line:prefer-function-over-method
  getTransactionRollbackSQL(): string {
    return 'ROLLBACK';
  }

  abstract async doTransactionEnd(): Promise<void>;

  async end(): Promise<void> {
    await this.transaction.end();
  }

  public isRolledBack(): boolean {
    return this.rolledBack;
  }
}
