import { suite, test } from 'mocha-typescript';
import * as must from 'must';
import {PostgresClient} from '../../src/postgres/PostgresClient';
import BaseApp from '../../src/app/BaseApp';
import PostgresPlugin from '../../src/postgres/PostgresPlugin';
import AutowirePlugin from '../../src/app/plugin/AutowirePlugin';
import LazyLoadingPlugin from '../../src/app/plugin/LazyLoadingPlugin';
import StartStopPlugin from '../../src/app/plugin/StartStopPlugin';
import DecoratorPlugin from '../../src/app/plugin/DecoratorPlugin';

@suite
class MySQLClientTest {
  baseApp: BaseApp;
  myClient: PostgresClient;

  async before() {
    this.baseApp = new BaseApp();
    this.baseApp.register(new AutowirePlugin(), new LazyLoadingPlugin(), new StartStopPlugin(), new DecoratorPlugin());
    this.baseApp.register(new PostgresPlugin());
    await this.baseApp.start();
    this.myClient = await this.baseApp.getContext().getObjectByName('PostgresClient');
  }

  @test
  async 'Basic/Gets all 3 records'() {
    const rows = await this.myClient.runInTransaction(true, (mysqlTransaction) => mysqlTransaction.query('SELECT * FROM table1'));
    rows.length.must.be.equal(3);
  }

  @test
  async 'Basic/Gets all 3 records twice'() {
    const rows = await this.myClient.runInTransaction(true, (mysqlTransaction) => mysqlTransaction.query('SELECT * FROM table1'));
    rows.length.must.be.equal(3);
    const rows2 = await this.myClient.runInTransaction(true, (mysqlTransaction) => mysqlTransaction.query('SELECT name FROM table1'));
    rows2.length.must.be.equal(3);
  }

  @test
  async 'Rollback/Rolls back if there\'s an error'() {
    const holder = {};
    try {
      const rows = await this.myClient.runInTransaction(true, async (mysqlTransaction) => {
        holder['transaction'] = mysqlTransaction;
        return await mysqlTransaction.query('SELECT table1');
      });
      true.must.equal(false);
    } catch(cause) {
      cause.must.be.an.error(/column "table1" does not exist/);
      holder['transaction'].isRolledBack().must.be.true();
    }
  }

  @test
  async 'Read/Must run queries'() {
    const rows = await this.myClient.read('SELECT * FROM table1');
    rows.length.must.be.equal(3);
  }

  @test
  async 'Read/Must bind parameters'() {
    const rows = await this.myClient.read('SELECT * FROM table1 WHERE name = $1', 'User 2');
    rows.length.must.be.equal(1);
  }

  async after() {
    await this.baseApp.stop();
  }
}
