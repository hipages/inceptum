const mysql = require('mysql');
const { TransactionManager } = require('../transaction/TransactionManager');
const { PromiseUtil } = require('../util/PromiseUtil');
const log = require('../log/LogManager').getLogger(__filename);

function runQueryOnPool(connection, sql, bindsArr) {
  // console.log(sql);
  log.debug(`sql: ${sql} ${(bindsArr && (bindsArr.length > 0)) ? `| ${bindsArr}` : ''}`);
  if (!Array.isArray(bindsArr)) {
    bindsArr = [];
  }

  return new Promise((resolve, reject) =>
    connection.query(sql, bindsArr, (err, rows) => {
      if (err) {
        log.error({ err }, `SQL error for ${sql}`);
        return reject(err);
      }
      return resolve(rows);
    })
  );
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

function runQueryPrivate(sql, bindsArr) {
  return PromiseUtil.try(() => {
    if (!this.connection) {
      return getConnectionPromise(this.myslqClient.getConnectionPoolForReadonly(this.transaction.isReadonly()));
    }
    return this.connection;
  })
    .then((connection) => { this.connection = connection; return connection; })
    .then((connection) => runQueryOnPool(connection, `/* Transaction Id ${this.transaction.id} */ ${sql}`, bindsArr));
}

class MysqlTransaction {
  /**
   *
   * @param {MysqlClient} myslqClient
   * @param transaction
   */
  constructor(myslqClient, transaction) {
    this.myslqClient = myslqClient;
    this.transaction = transaction;
  }

  begin() {
    return runQueryPrivate.call(this, 'BEGIN')
      .then(() => {
        this.transaction.begin();
        this.transaction.addCommitListener(() => runQueryPrivate.call(this, 'COMMIT'));
        this.transaction.addRollbackListener(() => runQueryPrivate.call(this, 'ROLLBACK'));
      });
  }

  query(sql, ...bindArrs) {
    return runQueryPrivate.call(this, sql, bindArrs);
  }

  end() {
    return this.transaction.end()
      .then(() => {
        if (this.connection) {
          this.connection.release();
        }
      });
  }

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

  /**
   * Runs a function in a transaction. The function must receive one parameter that will be of class
   * {MysqlTransaction} and that you need to use to run all queries in this transaction
   *
   * @param {boolean} readonly Whether the transaction needs to be readonly or not
   * @param {Function} func A function that returns a promise that will execute all the queries wanted in this transaction
   * @returns {Promise} A promise that will execute the whole transaction
   */
  runInTransaction(readonly, func) {
    const transaction = TransactionManager.newTransaction(readonly);
    const mysqlTransaction = new MysqlTransaction(this, transaction);
    return mysqlTransaction.begin()
      .then(() => func(mysqlTransaction))
      .catch((err) => {
        log.error({ err }, 'There was an error running in transaction');
        transaction.markError(err);
        throw err;
      })
      .finally(() => mysqlTransaction.end());
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

module.exports = { MysqlClient, TestUtil };
