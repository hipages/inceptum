// Test...
const { TransactionManager } = require('../../src/transaction/TransactionManager');
const demand = require('must');

class Util {
  constructor() {
    this.calls = [];
    this.committed = false;
    this.rolledBack = false;
  }
  method1() {
    this.calls.push('method1');
  }
  mustBeInTransaction() {
    return Promise.try(() => {
      const currentTransaction = TransactionManager.getCurrentTransaction();
      demand(currentTransaction).is.not.undefined();
    });
  }
  runMethod1InReadonly() {
    return Promise.try(() => {
      const currentTransaction = TransactionManager.getCurrentTransaction();
      demand(currentTransaction).is.not.undefined();
      currentTransaction.isReadonly().must.be.true();
    });
  }
  runMethod1InReadWrite() {
    return Promise.try(() => {
      const currentTransaction = TransactionManager.getCurrentTransaction();
      demand(currentTransaction).is.not.undefined();
      currentTransaction.isReadonly().must.be.false();
    });
  }
  getTransaction() {
    return Promise.resolve(TransactionManager.getCurrentTransaction());
  }
  checkTransactionReused() {
    const currentTransaction = TransactionManager.getCurrentTransaction();
    currentTransaction.marker1 = 'the value of marker1';
    return TransactionManager.runInTransaction(true, Util.prototype.validateMarker1, this);
  }
  delegateToReadWriteTransaction() {
    return TransactionManager.runInTransaction(false, Util.prototype.noop, this);
  }
  delegateToReadOnlyTransaction() {
    return TransactionManager.runInTransaction(true, Util.prototype.noop, this);
  }

  validateMarker1() {
    return Promise.try(() => {
      const currentTransaction = TransactionManager.getCurrentTransaction();
      demand(currentTransaction.marker1).be.not.undefined();
      currentTransaction.marker1.must.be.equal('the value of marker1');
    });
  }
  checkTransactionStarted() {
    TransactionManager.getCurrentTransaction().hasBegun().must.be.true();
  }
  noop() {
    // console.log('In Noop');
  }
  markTransaction() {
    return Promise.try(() => {
      TransactionManager.getCurrentTransaction().myMark = 1;
    });
  }
  validateNoMarkInTransaction() {
    return Promise.try(() => {
      demand(TransactionManager.getCurrentTransaction().myMark).must.be.undefined();
    });
  }
  saveTransactionAndThrow(container) {
    container.transaction = TransactionManager.getCurrentTransaction();
    return Promise.reject(new Error('Exception thrown'));
  }
  registerCommitListener(listener) {
    TransactionManager.getCurrentTransaction().addCommitListener(listener);
  }
  registerRollbackListenerAndThrow(listener) {
    TransactionManager.getCurrentTransaction().addRollbackListener(listener);
    throw new Error('Exception thrown');
  }
}

const util = new Util();

describe('transaction/TransactionManager', () => {
  describe('Transaction', () => {
    it('Must create a transaction when run in a transaction', () =>
      TransactionManager.runInTransaction(true, Util.prototype.mustBeInTransaction, util)
    );
    it('Must create a readonly transaction', () =>
      TransactionManager.runInTransaction(true, Util.prototype.runMethod1InReadonly, util)
    );
    it('Must create a readwrite transaction', () =>
      TransactionManager.runInTransaction(false, Util.prototype.runMethod1InReadWrite, util)
    );
    it('Must create transactions on each call to runInTransaction', () =>
      TransactionManager.runInTransaction(true, Util.prototype.markTransaction, util)
        .then(() => TransactionManager.runInTransaction(true, Util.prototype.validateNoMarkInTransaction, util)));
  });
  describe('Transaction reuse', () => {
    it('Must reuse the existing transaction', () =>
      TransactionManager.runInTransaction(true, Util.prototype.checkTransactionReused, util)
    );
    it('Can execute a readonly transaction inside of a readwrite one', () =>
      TransactionManager.runInTransaction(false, Util.prototype.delegateToReadOnlyTransaction, util)
    );
    it('Can\'t execute a readwrite transaction inside of a readonly one', () =>
      TransactionManager.runInTransaction(true, Util.prototype.delegateToReadWriteTransaction, util)
        .then(() => { throw new Error('Unexpected continuation'); })
        .catch((e) => {
          e.must.be.an.error('Can\'t execute a readwrite transaction inside of an already started readonly one');
        })
    );
  });
  describe('Pass the transaction down the promise', () => {
    const checkPromise = () => {
      demand(TransactionManager.getCurrentTransaction()).is.not.falsy();
    };
    it('passes the transaction', () =>
// eslint-disable-next-line no-undef
       TransactionManager.runInTransaction(true, () => PromiseUtil.try(() => {
         demand(TransactionManager.getCurrentTransaction()).is.not.falsy();
       })
      .then(() => new Promise((resolve) => {
        setTimeout(resolve, 1000);
        demand(TransactionManager.getCurrentTransaction()).is.not.falsy();
        checkPromise();
      }))
      .then(() => {
        checkPromise();
        demand(TransactionManager.getCurrentTransaction()).is.not.falsy();
      })));
  });
  describe('Lifecycle', () => {
    it('Must be started by the time it gets to the execution of the method', () =>
      TransactionManager.runInTransaction(true, Util.prototype.checkTransactionStarted, util)
    );
    it('Must commit a successful transaction', () =>
      TransactionManager.runInTransaction(true, Util.prototype.getTransaction, util)
        .then((transaction) => {
          transaction.finished.must.be.true();
          demand(transaction.error).must.be.null();
        })
    );
    it('Must rollback a failed transaction', () => {
      const container = {};
      return TransactionManager.runInTransaction(true, Util.prototype.saveTransactionAndThrow, util, [container])
        .then(() => { throw new Error('Was expecting an exception'); })
        .catch((e) => {
          e.must.be.an.error(/Exception thrown/);
        })
        .then(() => {
          demand(container.transaction).not.be.undefined();
          container.transaction.finished.must.be.true();
          demand(container.transaction.error).is.not.falsy();
          container.transaction.error.must.be.an.error(/Exception thrown/);
        });
    });
    it('Must call commit callbacks', () => {
      const myCallback = () => {
        // console.log('Committed');
        myCallback.called = true;
      };
      return TransactionManager.runInTransaction(true, Util.prototype.registerCommitListener, util, [myCallback])
        .then(() => {
          demand(myCallback.called).not.be.undefined();
          myCallback.called.must.be.true();
        });
    });
    it('Must call rollback callbacks', () => {
      const myCallback = () => {
        // console.log('Rolled back');
        myCallback.called = true;
      };
      return TransactionManager.runInTransaction(true, Util.prototype.registerRollbackListenerAndThrow, util, [myCallback])
        .then(() => {
          throw Error('Unexpected continuation');
        })
        .catch((e) => {
          e.must.be.an.error('Exception thrown');
          demand(myCallback.called).not.be.undefined();
          myCallback.called.must.be.true();
        });
    });
  });
});
