const { PostgresClient } = require('../../src/postgres/PostgresClient');

const myClient = new PostgresClient({
  name: 'TestClient',
  master: { connectionConfig: { database: 'testdb'} }
});
myClient.initialise();

describe('PostgresClient', () => {
  describe('Basic queries', () => {
    it('Gets all 3 records', 
    () => myClient.runInTransaction(true, (mysqlTransaction) => mysqlTransaction.query('SELECT * FROM table1 as TT'))
        .then((rows) => {
          rows.length.must.be.equal(3);
        })
     );
    it('Gets all 3 records inside', () => myClient.runInTransaction(true,
      (mysqlTransaction) => mysqlTransaction.query('SELECT * FROM table1')
        .then((rows) => {
          rows.length.must.be.equal(3);
        })
    ));
    it('Gets all 3 records twice', () => myClient.runInTransaction(true,
      (mysqlTransaction) => mysqlTransaction.query('SELECT * FROM table1')
        .then((rows) => {
          rows.length.must.be.equal(3);
        })
        .then(() => mysqlTransaction.query('SELECT name FROM table1'))
        .then((rows) => {
          rows.length.must.be.equal(3);
        })
    ));
  });
  describe('Rolling Back', () => {
    it('Rolls back if there\'s an error', 
    async () => {
      const holder = {};
      try {
        const rows = await myClient.runInTransaction(true, (mysqlTransaction) => {
          holder.transaction = mysqlTransaction;
          return mysqlTransaction.query('SELECT * FROM table2')
        })
        true.must.equal(false);
      } catch(cause) {
        cause.must.be.an.error(/relation "table2" does not exist/);
        holder.transaction.isRolledBack().must.be.true();
      }
    });
  });
  describe('client.read()', () => {
    it('must run queries', async () => {
      const rows = await myClient.read('SELECT * FROM table1');
      rows.length.must.be.equal(3);
    });
    it('must correctly bind values to the queies', async () => {
      const rows = await myClient.read('SELECT * FROM table1 WHERE name = ?', 'User 2');
      rows.length.must.be.equal(1);
    });
  });
});
