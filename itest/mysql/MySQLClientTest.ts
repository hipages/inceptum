import { suite, test } from 'mocha-typescript';
import * as must from 'must';
import BaseApp from '../../src/app/BaseApp';
import { MySQLClient } from '../../src/mysql/MySQLClient';
import MySQLPlugin from '../../src/mysql/MySQLPlugin';
import AutowirePlugin from '../../src/app/plugin/AutowirePlugin';
import LazyLoadingPlugin from '../../src/app/plugin/LazyLoadingPlugin';
import StartStopPlugin from '../../src/app/plugin/StartStopPlugin';
import DecoratorPlugin from '../../src/app/plugin/DecoratorPlugin';

@suite
class MySQLClientTest {
  baseApp: BaseApp;
  myClient: MySQLClient;

  async before() {
    this.baseApp = new BaseApp();
    this.baseApp.register(new AutowirePlugin(), new LazyLoadingPlugin(), new StartStopPlugin(), new DecoratorPlugin());
    this.baseApp.register(new MySQLPlugin());
    await this.baseApp.start();
    this.myClient = await this.baseApp.getContext().getObjectByName('MysqlClient');
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
        await mysqlTransaction.query('SELECT FROM table1');
      });
      true.must.equal(false);
    } catch(cause) {
      cause.must.be.an.error(/You have an error in your SQL syntax/);
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
    const rows = await this.myClient.read('SELECT * FROM table1 WHERE name = ?', 'User 2');
    rows.length.must.be.equal(1);
  }

  async after() {
    await this.baseApp.stop();
  }
}
