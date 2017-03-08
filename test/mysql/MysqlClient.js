/* eslint-disable no-console */

// const LogManager =
require('../../src/log/LogManager');
const { TestUtil } = require('../../src/mysql/MysqlClient');
// const sinon = require('sinon');
// const co = require('co');
const Promise = require('bluebird');

class FakeConnectionPool {
  constructor() {
    this.availableConnections = [];
    this.currentConnIndex = 0;
  }
  addConnection(conn) {
    this.availableConnections.push(conn);
  }
  getNextConnection() {
    if (this.availableConnections.length === 0) {
      throw new Error('Haven\'t registered any connection');
    }
    return this.availableConnections[this.currentConnIndex++ % this.availableConnections.length];
  }
  getConnection(cb) {
    if (this.errorOnConnection) {
      cb(this.errorOnConnection, null);
    } else {
      cb(null, this.getNextConnection());
    }
  }
}

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
  describe('runQueryOnPool', () => {
    it('returns a promise', () => {
      const fakeCP = new FakeConnectionPool();
      const connMock = new MockConnection();
      connMock.registerResult('Empty', [], []);
      fakeCP.addConnection(connMock);
      const resp = TestUtil.runQueryOnPool(fakeCP, 'Empty', []);
      resp.must.be.an.instanceOf(Promise);
    });
    it('Resolves the promise with data if there\'s no error', function* () {
      const fakeCP = new FakeConnectionPool();
      const connMock = new MockConnection();
      connMock.registerResult('Empty', [[1, 'a']], []);
      fakeCP.addConnection(connMock);
      const resp = TestUtil.runQueryOnPool(fakeCP, 'Empty', [[1, 'a']]);
      let executed = false;
      resp.then((val) => {
        val.must.be.an.array();
        val.length.must.be.equal(0);
        executed = true;
      }).then(() => {
        executed.must.be.true();
      });
    });
    it('Rejects the promise when there\'s an error on the sql', function* () {
      const fakeCP = new FakeConnectionPool();
      const connMock = new MockConnection();
      connMock.throwOnQuery = new Error('Thrown inside connection query');
      connMock.registerResult('Empty', [[1, 'a']], []);
      fakeCP.addConnection(connMock);
      const resp = TestUtil.runQueryOnPool(fakeCP, 'Empty', [[1, 'a']]);
      yield resp.then(() => {
        true.must.be.false();
      }).catch((err) => {
        err.must.be.an.error();
      });
    });
  });
});
