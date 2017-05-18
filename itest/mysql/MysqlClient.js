const { MysqlClient } = require('../../src/mysql/MysqlClient');

const myClient = new MysqlClient();
myClient.name = 'TestClient';
myClient.configuration = {
  Verbose: true,
  master: { database: 'testdb' }
};

myClient.initialise();

describe('MysqlClient', () => {
  describe('Basic queries', () => {
    it('Gets all 3 records', 
    () => myClient.runInTransaction(true, (mysqlTransaction) => mysqlTransaction.query('SELECT * FROM table1'))
        .then((rows) => {
          rows.length.must.be.equal(3);
          console.log(rows.length);
        })
     );
    it('Gets all 3 records inside', (done) => myClient.runInTransaction(true,
      (mysqlTransaction) => mysqlTransaction.query('SELECT * FROM table1')
        .then((rows) => {
          rows.length.must.be.equal(3);
          console.log(rows);
          done();
        })
    ));
    it('Gets all 3 records twice', (done) => myClient.runInTransaction(true,
      (mysqlTransaction) => mysqlTransaction.query('SELECT * FROM table1')
        .then((rows) => {
          console.log('HERE');
          rows.length.must.be.equal(3);
          console.log(rows);
        })
        .then(() => mysqlTransaction.query('SELECT name FROM table1'))
        .then((rows) => {
          rows.length.must.be.equal(3);
          console.log(rows);
          done();
        })
    ));
  });
});
