// Test...
const { TransactionManager } = require('../../src/transaction/TransactionManager');
const demand = require('must');
const co = require('co');

class Util {
  constructor() {
    this.calls = [];
    this.committed = false;
    this.rolledBack = false;
  }
  method1() {
    this.calls.push('method1');
  }
  * mustBeInTransaction() {
    return co.withSharedContext((context) => {
      demand(context).is.not.undefined();
      demand(context.currentTransaction).is.not.undefined();
    });
  }
  * runMethod1InReadonly() {
    return co.withSharedContext((context) => {
      demand(context).is.not.undefined();
      demand(context.currentTransaction).is.not.undefined();
      context.currentTransaction.isReadonly().must.be.true();
    });
  }
  * runMethod1InReadWrite() {
    return co.withSharedContext((context) => {
      demand(context).is.not.undefined();
      demand(context.currentTransaction).is.not.undefined();
      context.currentTransaction.isReadonly().must.be.false();
    });
  }
  * setVal(key, val) {
    return co.withSharedContext((context) => {
      context[key] = val;
    });
  }
  * getVal(key) {
    return co.withSharedContext(
      (context) =>
        context[key]
    );
  }
  * getTransaction() {
    return co.withSharedContext((context) => context.currentTransaction);
  }
  * checkTransactionReused() {
    return co.withSharedContext(function* (context) {
      context.marker1 = 'the value of marker1';
      yield TransactionManager.runInTransaction(true, Util.prototype.validateMarker1, this);
    });
  }
  * delegateToReadWriteTransaction() {
    yield TransactionManager.runInTransaction(false, Util.prototype.noop, this);
  }
  * delegateToReadOnlyTransaction() {
    yield TransactionManager.runInTransaction(true, Util.prototype.noop, this);
  }

  * validateMarker1() {
    return co.withSharedContext((context) => {
      demand(context.marker1).be.not.undefined();
      context.marker1.must.be.equal('the value of marker1');
    });
  }
  * checkTransactionStarted() {
    return co.withSharedContext((context) => {
      context.currentTransaction.hasBegun().must.be.true();
    });
  }
  * noop() {
    // console.log('In Noop');
  }
  * markTransaction() {
    return co.withSharedContext((context) => {
      context.currentTransaction.myMark = 1;
    });
  }
  * validateNoMarkInTransaction() {
    return co.withSharedContext((context) => {
      demand(context.currentTransaction.myMark).must.be.undefined();
    });
  }
  * saveTransactionAndThrow() {
    return co.withSharedContext((context) => {
      context.savedTransaction = context.currentTransaction;
      throw new Error('Exception thrown');
    });
  }
  * registerCommitListener(listener) {
    return co.withSharedContext((context) => {
      context.currentTransaction.addCommitListener(listener);
    });
  }
  * registerRollbackListenerAndThrow(listener) {
    return co.withSharedContext((context) => {
      context.currentTransaction.addRollbackListener(listener);
      throw new Error('Exception thrown');
    });
  }
}

const util = new Util();

describe('transaction/TransactionManager', () => {
  describe('Transaction', () => {
    it('Must create a transaction when run in a transaction', function* () {
      return yield TransactionManager.runInTransaction(true, Util.prototype.mustBeInTransaction, util);
    });
    it('Must create a readonly transaction', function* () {
      return yield TransactionManager.runInTransaction(true, Util.prototype.runMethod1InReadonly, util);
    });
    it('Must create a readwrite transaction', function* () {
      return yield TransactionManager.runInTransaction(false, Util.prototype.runMethod1InReadWrite, util);
    });
    it('Must share a context across transactions', function* () {
      yield TransactionManager.runInTransaction(true, Util.prototype.setVal, util, ['key1', 'the value']);
      const value =
        yield TransactionManager.runInTransaction(true, Util.prototype.getVal, util, ['key1']);
      demand(value).not.be.undefined();
      value.must.be.equal('the value');
    });
    it('Must create transactions on each call to runInTransaction', function* () {
      yield TransactionManager.runInTransaction(true, Util.prototype.markTransaction, util);
      yield TransactionManager.runInTransaction(true, Util.prototype.validateNoMarkInTransaction, util);
    });
  });
  describe('Transaction reuse', () => {
    it('Must reuse the existing transaction', function* () {
      yield TransactionManager.runInTransaction(true, Util.prototype.checkTransactionReused, util);
    });
    it('Can execute a readonly transaction inside of a readwrite one', function* () {
      yield TransactionManager.runInTransaction(false, Util.prototype.delegateToReadOnlyTransaction, util);
    });
    it('Can\'t execute a readwrite transaction inside of a readonly one', function* () {
      try {
        yield TransactionManager.runInTransaction(true, Util.prototype.delegateToReadWriteTransaction, util);
        true.must.be.false();
      } catch (e) {
        e.must.be.an.error('Can\'t execute a readwrite transaction inside of an already started readonly one');
      }
    });
  });
  describe('Lifecycle', () => {
    it('Must be started by the time it gets to the execution of the method', function* () {
      yield TransactionManager.runInTransaction(true, Util.prototype.checkTransactionStarted, util);
    });
    it('Must commit a successful transaction', function* () {
      const transaction = yield TransactionManager.runInTransaction(true, Util.prototype.getTransaction, util);
      transaction.finished.must.be.true();
      demand(transaction.error).must.be.null();
    });
    it('Must rollback a failed transaction', function* () {
      try {
        yield TransactionManager.runInTransaction(true, Util.prototype.saveTransactionAndThrow, util);
        false.must.be.true();
      } catch (e) {
        e.must.be.an.error(/Exception thrown/);
      }
      const transaction = yield util.getVal('savedTransaction');
      demand(transaction).not.be.undefined();
      transaction.finished.must.be.true();
      transaction.error.must.be.an.error(/Exception thrown/);
    });
    it('Must call commit callbacks', function* () {
      const myCallback = () => {
        // console.log('Committed');
        myCallback.called = true;
      };
      yield TransactionManager.runInTransaction(true, Util.prototype.registerCommitListener, util, [myCallback]);
      demand(myCallback.called).not.be.undefined();
      myCallback.called.must.be.true();
    });
    it('Must call rollback callbacks', function* () {
      const myCallback = () => {
        // console.log('Rolled back');
        myCallback.called = true;
      };
      try {
        yield TransactionManager.runInTransaction(true, Util.prototype.registerRollbackListenerAndThrow, util, [myCallback]);
        true.must.be.false();
      } catch (e) {
        e.must.be.an.error('Exception thrown');
      }
      demand(myCallback.called).not.be.undefined();
      myCallback.called.must.be.true();
    });
  });
});
