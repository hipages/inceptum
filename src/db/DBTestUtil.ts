import { LogManager } from '../log/LogManager';
import { DBClient } from './DBClient';
import { DBTransaction } from './DBTransaction';

const logger = LogManager.getLogger(__filename);

export class MockDBTransaction extends DBTransaction {
  mockClient: MockDBClient;
  constructor(mockClient: MockDBClient) {
    super(null);
    this.mockClient = mockClient;
  }
  query(sql: string, ...bindArrs: any[]): Promise<any> {
    const resp = this.mockClient.hasQuery(sql, bindArrs);
    if (!resp) {
      logger.warn(`Unknown sql query called: ${sql} with params: ${JSON.stringify(bindArrs)}`);
      return Promise.resolve([]);
    }
    if (resp instanceof Error) {
      return Promise.reject(resp);
    }
    return Promise.resolve(resp);
  }
  // tslint:disable-next-line:prefer-function-over-method
  protected runQueryPrivate(sql: string, bindArrs?: any[]): Promise<any> {
    throw new Error('Method not implemented.');
  }
  // tslint:disable-next-line:prefer-function-over-method
  protected runQueryAssocPrivate(sql: string, bindObj?: object): Promise<any> {
    throw new Error('Method not implemented.');
  }
  // tslint:disable-next-line:prefer-function-over-method
  doTransactionEnd(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

export interface SavedQuery {
  sql: string,
  bindArrs: Array<any>,
  resp: any,
}

export class MockDBClient extends DBClient {
  registeredQueries: SavedQuery[];
  public runInTransaction(readonly: boolean, func: (transaction: DBTransaction) => Promise<any>): Promise<any> {
    return func(new MockDBTransaction(this));
  }
  public registerQuery(sql: string, resp: any, ...bindArrs) {
    this.registeredQueries.push({sql, resp, bindArrs: bindArrs || []});
  }
  public hasQuery(sql: string, params: any[]) {
    const query = this.registeredQueries.find((sq) => (sq.sql === sql) && params.length === sq.bindArrs.length && sq.bindArrs.findIndex((expected, idx) => expected !== params[idx]) >= 0);
    return query ? query.resp : null;
  }
}
