const { MysqlClient, RowConsumer } = require('../../src/mysql/MysqlClient');
const { TransactionManager } = require('../../src/transaction/TransactionManager');

const myClient = new MysqlClient();
myClient.name = 'TestClient';
myClient.configuration = {
  Verbose: true,
  master: { database: 'testdb' }
};

myClient.initialise();

class CountingRowConsumer extends RowConsumer {
  constructor() {
    super();
    this.counter = 0;
  }
// eslint-disable-next-line no-unused-vars
  consume(row) {
    this.counter++;
  }
  getNumRows() {
    return this.counter;
  }
}

describe('MysqlClient', () => {
  describe('Basic queries', () => {
    it('Gets all 3 records', () =>
      TransactionManager.runInTransaction(true, () => myClient.queryAll('SELECT * FROM table1')
        .then((rows) => {
          rows.length.must.be.equal(3);
          console.log(rows);
        })
      )
    );
    it('Gets all 3 records twice', () => {
      return TransactionManager.runInTransaction(true, () => {
        return myClient.queryAll('SELECT * FROM table1')
          .then((rows) => {
            console.log(rows);
            rows.length.must.be.equal(3);
          })
          .then(() => myClient.queryAll('SELECT name FROM table1'))
          .then((rows) => {
            console.log(rows);
            rows.length.must.be.equal(3);
          });
      })}
    );
  });
  describe('Row Consumer', () => {
    it('Counts 3 records', function* () {
      yield TransactionManager.runInTransaction(true, function* () {
        const rowConsumer = new CountingRowConsumer();
        yield myClient.queryIntoRowConsumer('SELECT * FROM table1', rowConsumer);
        rowConsumer.getNumRows().must.be.equal(3);
      });
    });
  });
});
