/* eslint-disable no-console */

require('../../src/log/LogManager');
const { MysqlTransaction } = require('../../src/mysql/MySQLClient');

class MockConnection {
  constructor() {
    this.callMap = new Map();
  }
  registerResult(sql, binds, result) {
    const key = JSON.stringify({ sql, binds });
    this.callMap.set(key, result);
  }
  query(sql, binds, cb) {
    if (this.throwOnQuery) {
      cb(this.throwOnQuery, null);
      return;
    }
    const key = JSON.stringify({ sql, binds });
    if (this.callMap.has(key)) {
      cb(null, this.callMap.get(key));
    }
    throw new Error(`Unknown query: ${key}`);
  }
  release() {}
}

describe('mysql/MysqlClient', () => {
  // describe('runQueryOnPool', () => {
  //   it('returns a promise', () => {
  //     const connMock = new MockConnection();
  //     connMock.registerResult('Empty', [], []);
  //     new MysqlTransaction()
  //     const resp = TestUtil.runQueryOnPool(connMock, 'Empty', []);
  //     resp.must.be.an.instanceOf(Promise);
  //   });
  //   it('Resolves the promise with data if there\'s no error', () => {
  //     const connMock = new MockConnection();
  //     connMock.registerResult('Empty', [[1, 'a']], []);
  //     const resp = TestUtil.runQueryOnPool(connMock, 'Empty', [[1, 'a']]);
  //     let executed = false;
  //     resp.then((val) => {
  //       val.must.be.an.array();
  //       val.length.must.be.equal(0);
  //       executed = true;
  //     }).then(() => {
  //       executed.must.be.true();
  //     });
  //   });
  //   it('Rejects the promise when there\'s an error on the sql', () => {
  //     const connMock = new MockConnection();
  //     connMock.throwOnQuery = new Error('Thrown inside connection query');
  //     connMock.registerResult('Empty', [[1, 'a']], []);
  //     const resp = TestUtil.runQueryOnPool(connMock, 'Empty', [[1, 'a']]);
  //     return resp.then(() => {
  //       true.must.be.false();
  //     }).catch((err) => {
  //       err.must.be.an.error('Thrown inside connection query');
  //     });
  //   });
  // });
});
