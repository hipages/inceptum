const mysql = require('mysql');
const { TransactionManager } = require('../transaction/TransactionManager');

function runQueryOnPool(connectionPool, sql, bindsArr) {
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

class RowConsumer {
// eslint-disable-next-line no-unused-vars
  consume(row) {
    throw new Error('Unimplemented');
  }
}

class MysqlClient {
  constructor() {
    this.configuration = {};
    this.name = 'NotSet';
    this.masterPool = null;
    this.slavePool = null;
    this.enable57Mode = false;
  }
  // configuration and name are two properties set by MysqlConfigManager
  initialise() {
    this.verbose = this.configuration.Verbose || false;
    this.enable57Mode = this.configuration.enable57Mode || false;
    if (this.configuration.master) {
      this.masterPool = mysql.createPool(this.getFullPoolConfig(this.configuration.master));
    }
    if (this.configuration.slave) {
      this.slavePool = mysql.createPool(this.getFullPoolConfig(this.configuration.slave));
    }
    if (!this.masterPool && !this.slavePool) {
      throw new Error(`MysqlClient ${this.name} has no connections configured for either master or slave`);
    }
  }
  shutdown() {
    if (this.masterPool) {
      this.masterPool.end();
    }
    if (this.slavePool) {
      this.slavePool.end();
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
    return TransactionManager.withTransaction(function* (currentTransaction) {
      binds = Array.isArray(binds) ? binds : [];
      if (!currentTransaction) {
        throw new Error(`Shouldn't run queries outside of a transaction: ${sql}`);
      }
      const connectionPool = this.getConnectionPoolForReadonly(currentTransaction.isReadonly());
      yield this.setupTransaction(currentTransaction, connectionPool);
      return runQueryOnPool.call(this, connectionPool, sql, binds);
    }, this);
  }

  /**
   *
   * @param {string} sql
   * @param {Array} binds
   * @return {Array} an array of all rows returned by the query.
   */
  * execute(sql, binds) {
    return TransactionManager.withTransaction(function* (currentTransaction) {
      binds = Array.isArray(binds) ? binds : [];
      if (!currentTransaction) {
        throw new Error(`Shouldn't run queries outside of a transaction: ${sql}`);
      }
      const connectionPool = this.getConnectionPoolForReadonly(currentTransaction.isReadonly());
      yield this.setupTransaction(currentTransaction, connectionPool);
      return runQueryOnPool.call(this, connectionPool, sql, binds);
    }, this);
  }

  /**
   * Executes a query and streams rows into a generator.
   * @param sql
   * @param consumer
   * @param binds
   * @return {Promise} a promise with the return value of the generator function or any error
   */
  * queryIntoRowConsumer(sql, consumer, binds) {
    return TransactionManager.withTransaction(function* (currentTransaction) {
      binds = Array.isArray(binds) ? binds : [];
      if (!currentTransaction) {
        throw new Error(`Shouldn't run queries outside of a transaction: ${sql}`);
      }
      const connectionPool = this.getConnectionPoolForReadonly(currentTransaction.isReadonly());
      yield this.setupTransaction(currentTransaction, connectionPool);
      return new Promise((resolve, reject) => {
        connectionPool.getConnection((err, connection) => {
          if (err) {
            reject(err);
            return;
          }
          if (this.verbose) {
            console.log(`sql: ${sql}`);
          }
          const q = connection.query(sql, binds);
          q.on('error', (err) => { q.removeAllListeners(); reject(err); });
          const highMark = 10;
          consumer.concurrentProcessing = 0;
          consumer.paused = false;
          q.on('result', (row) => {
            if (!consumer.paused && consumer.concurrentProcessing >= highMark) {
              connection.pause();
              consumer.paused = true;
            }
            try {
              consumer.concurrentProcessing++;
              consumer.consume(row);
            } catch (e) {
              reject(e);
              return;
            } finally {
              consumer.concurrentProcessing--;
              if (consumer.paused && consumer.concurrentProcessing < highMark) {
                consumer.resume();
              }
            }
          });
          q.once('end', () => {
            q.removeAllListeners();
            resolve(consumer);
          });
        });
      });
    }, this);
  }

  * setupTransaction(transaction, connectionPool) {
    // console.log('Entering setuptransaction');
    if (!transaction.mysqlInited) {
      // console.log(`Setting up transaction ${transaction.id} for ${TransactionManager.Events.COMMIT}`);
      if (this.enable57Mode) {
        yield runQueryOnPool.call(this, connectionPool, `START TRANSACTION ${transaction.isReadonly() ? ' READ ONLY' : ' READ WRITE'}`);
      } else {
        yield runQueryOnPool.call(this, connectionPool, 'BEGIN');
      }
      transaction.mysqlInited = true;
      const self = this;
      // console.log(`Setting up 2 transaction ${transaction.id} for ${TransactionManager.Events.COMMIT}`);
      transaction.addCommitListener(function* () {
        yield runQueryOnPool.call(self, connectionPool, 'COMMIT');
      });
      // console.log(`Setting up 3 transaction ${transaction.id} for ${TransactionManager.Events.COMMIT}`);
      transaction.addRollbackListener(function* () {
        yield runQueryOnPool.call(self, connectionPool, 'ROLLBACK');
      });
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
MysqlClient.stopMethod = 'shutdown';

module.exports = { MysqlClient, RowConsumer };
