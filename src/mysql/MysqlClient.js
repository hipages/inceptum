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
    if (!Array.isArray(binds)) {
      binds = [];
    }
    if (!TransactionManager.transactionExists()) {
      // executing a query outside of a transaction is not a good idea
      throw new Error('Shouldn\'t run queries outside of a transaction');
    }
    const transaction = TransactionManager.getCurrentTransaction();
    const connectionPool = this.getConnectionPoolForReadonly(transaction.isReadonly());
    yield MysqlClient.setupTransaction(transaction, connectionPool);
    return MysqlClient.runQueryOnPool(connectionPool, sql, binds);
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

  static runQueryOnPool(connectionPool, sql, bindsArr) {
    if (this.verbose) {
      console.log(sql);
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

  static* setupTransaction(transaction, connectionPool) {
    if (!transaction.mysqlInited) {
      // console.log(`Setting up transaction ${transaction.id} for ${TransactionManager.Events.COMMIT}`);
      yield MysqlClient.runQueryOnPool(connectionPool, `START TRANSACTION ${transaction.isReadonly() ? ' READ ONLY' : ' READ WRITE'}`);
      transaction.mysqlInited = true;
      // console.log(`Setting up 2 transaction ${transaction.id} for ${TransactionManager.Events.COMMIT}`);
      transaction.on(TransactionManager.Events.COMMIT, () => {
        // console.log('commit got called');
        co(MysqlClient.runQueryOnPool(connectionPool, 'COMMIT'))
          .then(() => {});
      });
      // console.log(`Setting up 3 transaction ${transaction.id} for ${TransactionManager.Events.COMMIT}`);
      transaction.once(TransactionManager.Events.ROLLBACK, () => co(MysqlClient.runQueryOnPool(connectionPool, 'ROLLBACK'))
        .then(() => {}));
    }
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
