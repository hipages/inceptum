const mysql = require('mysql');
const { TransactionManager } = require('../transaction/TransactionManager');
const Promise = require('bluebird');
const log = require('../log/LogManager').getLogger(__filename);

function runQueryOnPool(connection, sql, bindsArr) {
  // console.log(sql);
  log.debug(`sql: ${sql}`);
  if (!Array.isArray(bindsArr)) {
    bindsArr = [];
  }

  return new Promise((resolve, reject) =>
    connection.query(sql, bindsArr, (err, rows) => {
      if (err) {
        return reject(err);
      }
      return resolve(rows);
    })
  );
}

class RowConsumer {
// eslint-disable-next-line no-unused-vars
  consume(row) {
    throw new Error('Unimplemented');
  }
}

function getConnectionPromise(connectionPool) {
  return new Promise((resolve, reject) => {
    connectionPool.getConnection((err, connection) => {
      if (err) {
        reject(err);
      } else {
        resolve(connection);
      }
    });
  });
}

/**
 * A MySQL client you can use to execute queries against MySQL
 */
class MysqlClient {
  constructor() {
    this.configuration = {};
    this.name = 'NotSet';
    this.masterPool = null;
    this.slavePool = null;
    this.enable57Mode = false;
    this.connectionPoolCreator = (config) => mysql.createPool(config);
  }
  // configuration and name are two properties set by MysqlConfigManager
  initialise() {
    this.enable57Mode = this.configuration.enable57Mode || false;
    if (this.configuration.master) {
      this.masterPool = this.connectionPoolCreator(this.getFullPoolConfig(this.configuration.master));
    }
    if (this.configuration.slave) {
      this.slavePool = this.connectionPoolCreator(this.getFullPoolConfig(this.configuration.slave));
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
   * Execute a query
   * @param {string} sql
   * @param {Array} binds
   * @return {Array} an array of all rows returned by the query.
   */
  queryAll(sql, binds) {
    binds = Array.isArray(binds) ? binds : [];
    if (!TransactionManager.hasTransaction()) {
      throw new Error(`Shouldn't run queries outside of a transaction: ${sql}`);
    }
    return this.setupTransaction()
      .then((connection) => runQueryOnPool.call(this, connection, sql, binds));
  }

  /**
   *
   * @param {string} sql
   * @param {Array} binds
   * @return {Array} an array of all rows returned by the query.
   */
  execute(sql, binds) {
    return this.queryAll(sql, binds);
  }

  // /**
  //  * Executes a query and streams rows into a generator.
  //  * @param sql
  //  * @param consumer
  //  * @param binds
  //  * @return {Promise} a promise with the return value of the generator function or any error
  //  */
  // * queryIntoRowConsumer(sql, consumer, binds) {
  //   return TransactionManager.withTransaction(function* (currentTransaction) {
  //     binds = Array.isArray(binds) ? binds : [];
  //     if (!currentTransaction) {
  //       throw new Error(`Shouldn't run queries outside of a transaction: ${sql}`);
  //     }
  //     const connectionPool = this.getConnectionPoolForReadonly(currentTransaction.isReadonly());
  //     yield this.setupTransaction(currentTransaction, connectionPool);
  //     return new Promise((resolve, reject) => {
  //       connectionPool.getConnection((err, connection) => {
  //         if (err) {
  //           reject(err);
  //           return;
  //         }
  //         log.debug(`sql: ${sql}`);
  //         const q = connection.query(sql, binds);
  //         q.on('error', (err) => { q.removeAllListeners(); reject(err); });
  //         const highMark = 10;
  //         consumer.concurrentProcessing = 0;
  //         consumer.paused = false;
  //         q.on('result', (row) => {
  //           if (!consumer.paused && consumer.concurrentProcessing >= highMark) {
  //             connection.pause();
  //             consumer.paused = true;
  //           }
  //           try {
  //             consumer.concurrentProcessing++;
  //             consumer.consume(row);
  //           } catch (e) {
  //             reject(e);
  //             return;
  //           } finally {
  //             consumer.concurrentProcessing--;
  //             if (consumer.paused && consumer.concurrentProcessing < highMark) {
  //               consumer.resume();
  //             }
  //           }
  //         });
  //         q.once('end', () => {
  //           q.removeAllListeners();
  //           resolve(consumer);
  //         });
  //       });
  //     });
  //   }, this);
  // }

  setupTransaction() {
    // console.log('Entering setuptransaction');
    const transaction = TransactionManager.getCurrentTransaction();
    if (!transaction.mysqlConnection) {
      const connectionPool = this.getConnectionPoolForReadonly(transaction.isReadonly());
      return getConnectionPromise(connectionPool)
        .then((connection) => {
          transaction.mysqlConnection = connection;
        })
        .then(() => {
          if (this.enable57Mode) {
            return runQueryOnPool.call(this, transaction.mysqlConnection,
              `START TRANSACTION ${transaction.isReadonly() ? ' READ ONLY' : ' READ WRITE'}`);
          }
          return runQueryOnPool.call(this, transaction.mysqlConnection, 'BEGIN');
        })
        .then(() => {
          transaction.mysqlInited = true;
          const self = this;
          transaction.addCommitListener(() => runQueryOnPool.call(self, transaction.mysqlConnection, 'COMMIT')
            .then(() => { transaction.mysqlConnection.release(); transaction.mysqlConnection = null; }));
          transaction.addRollbackListener(() => runQueryOnPool.call(self, transaction.mysqlConnection, 'ROLLBACK')
            .then(() => { transaction.mysqlConnection.release(); transaction.mysqlConnection = null; }));
        })
        .then(() => transaction.mysqlConnection);
    }
    return Promise.resolve(transaction.mysqlConnection);
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

const TestUtil = { runQueryOnPool };

module.exports = { MysqlClient, RowConsumer, TestUtil };
