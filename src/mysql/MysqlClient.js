const mysql = require('mysql');
const co = require('co');
const { TransactionManager } = require('../transaction/TransactionManager');

class MysqlClient {
  constructor() {
    this.configuration = {};
    this.name = 'NotSet';
    this.masterPool = null;
    this.slavePool = null;
  }
  // configuration and name are two properties set by MysqlConfigManager
  initialise() {
    this.verbose = this.configuration.Verbose || false;
    if (this.configuration.Master) {
      this.masterPool = mysql.createPool(this.getFullPoolConfig(this.configuration.Master));
    }
    if (this.configuration.Slave) {
      this.slavePool = mysql.createPool(this.getFullPoolConfig(this.configuration.Slave));
    }
    if (!this.masterPool && !this.slavePool) {
      throw new Error(`MysqlClient ${this.name} has no connections configured for either master or slave`);
    }
  }
  getFullPoolConfig(partial) {
    const full = {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      charset: 'utf8',
      connectionLimit: 10
    };
    Object.assign(full, partial);
    return full;
  }

  /**
   *
   * @param {string} sql
   * @param {Array} binds
   * @return {Array} an array of all rows returned by the query.
   */
  * queryAll(sql, binds) {
    return co.withSharedContext(function* (sharedContext) {
      if (!Array.isArray(binds)) {
        binds = [];
      }
      if (!sharedContext.currentTransaction) {
        // executing a query outside of a transaction is not a good idea
        throw new Error(`Shouldn't run queries outside of a transaction: ${sql}`);
      }
      const transaction = sharedContext.currentTransaction;
      console.log(`Transaction ${transaction.id} ${transaction.mysqlInited}`);
      const connectionPool = this.getConnectionPoolForReadonly(transaction.isReadonly());
      // console.log('d');
      try {
        yield this.setupTransaction(transaction, connectionPool);
      } catch (e) {
        console.log(e);
      }
      // console.log('r');
      return this.runQueryOnPool(connectionPool, sql, binds);
    });
  }

  /**
   * Executes a query and streams rows into a generator.
   * @param sql
   * @param bindArr
   * @return {Promise} a promise with the return value of the generator function or any error
   */
  * queryIntoGenerator(sql, bindsArr, generator) {
    if (!Array.isArray(bindsArr)) {
      bindsArr = [];
    }
    const connectionPool = yield* this.getConnectionPoolForTransaction();
    const o = generator();
    o.next();
    const cor = function (x) {
      return o.next(x);
    };
    return new Promise((resolve, reject) => {
      connectionPool.getConnection((err, connection) => {
        if (err) {
          reject(err);
          return;
        }

        const q = connection.query(sql, bindsArr);
        q.on('error', (err) => { q.removeAllListeners(); reject(err); });
        q.on('result', (row) => {
          cor(row);
        });
        q.once('end', () => {
          q.removeAllListeners();
          const resp = cor(null);
          if (!resp.done) {
            reject(new Error('The generator didn\'t finish execution once it received null'));
          }
          resolve(resp.value);
        });
      });
    });
  }

  runQueryOnPool(connectionPool, sql, bindsArr) {
    // console.log(sql);
    if (this.verbose) {
      console.log(`sql: ${sql}`);
    }
    if (!Array.isArray(bindsArr)) {
      bindsArr = [];
    }

    return new Promise((resolve, reject) => {
      connectionPool.getConnection((err, connection) => {
        if (err) {
          return reject(err);
        }

        return connection.query(sql, bindsArr, (err, rows) => {
          connection.release();
          if (err) {
            return reject(err);
          }
          return resolve(rows);
        });
      });
    });
  }

  * setupTransaction(transaction, connectionPool) {
    // console.log('Entering setuptransaction');
    if (!transaction.mysqlInited) {
      // console.log(`Setting up transaction ${transaction.id} for ${TransactionManager.Events.COMMIT}`);
      yield this.runQueryOnPool(connectionPool, `START TRANSACTION ${transaction.isReadonly() ? ' READ ONLY' : ' READ WRITE'}`);
      transaction.mysqlInited = true;
      const self = this;
      // console.log(`Setting up 2 transaction ${transaction.id} for ${TransactionManager.Events.COMMIT}`);
      transaction.on(TransactionManager.Events.COMMIT, () => {
        // console.log('commit got called');
        co(self.runQueryOnPool(connectionPool, 'COMMIT'))
          .then(() => {});
      });
      // console.log(`Setting up 3 transaction ${transaction.id} for ${TransactionManager.Events.COMMIT}`);
      transaction.once(TransactionManager.Events.ROLLBACK, () => co(self.runQueryOnPool(connectionPool, 'ROLLBACK'))
        .then(() => {}));
    }
    // console.log('Leaving setuptransaction');
  }

  getConnectionPoolForReadonly(readonly) {
    if (readonly && this.slavePool) {
      return this.slavePool;
    } else if (this.masterPool) {
      return this.masterPool;
    }
    throw new Error('Couldn\'t find an appropriate connection pool');
  }
}

MysqlClient.startMethod = 'initialise';

module.exports = { MysqlClient };
