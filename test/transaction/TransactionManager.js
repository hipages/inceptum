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
    TransactionManager.getCurrentTransaction().must.not.be.undefined();
    TransactionManager.transactionExists().must.be.true();
  }
  geTransaction() {
    return TransactionManager.getCurrentTransaction();
  }
  runMethod1InReadonly() {
    this.calls.push('runMethod1InReadonly');
    TransactionManager.runInTransaction(true, this.method1, this);
  }
  runMethod1InReadWrite() {
    this.calls.push('method2');
    TransactionManager.runInTransaction(false, this.method1, this);
  }
  checkTransactionReused() {
    TransactionManager.getCurrentTransaction().marker1 = true;
    TransactionManager.runInTransaction(true, this.validateMarker1, this);
  }
  validateMarker1() {
    TransactionManager.getCurrentTransaction().marker1.must.be.true();
  }
  checkTransactionStarted() {
    TransactionManager.getCurrentTransaction().hasBegun().must.be.true();
  }
  setListeners(success) {
    this.committed = false;
    this.rolledBack = false;
    TransactionManager.getCurrentTransaction().once(TransactionManager.Events.COMMIT, () => { this.committed = true; });
    TransactionManager.getCurrentTransaction().once(TransactionManager.Events.ROLLBACK, () => { this.rolledBack = true; });
    if (!success) {
      throw new Error('Faking error');
    }
  }
}

const util = new Util();

describe('Transaction Manager', () => {
  describe('Transaction', () => {
    it('Return no transaction if there\'s no open transaction', () => {
      demand(TransactionManager.getCurrentTransaction()).be.undefined();
    });
    it('Must create a transaction when run in a transaction', () => {
      TransactionManager.runInTransaction(true, Util.prototype.mustBeInTransaction, util);
    });
    it('Must create a new transaction for each execution', () => {
      const transaction1 =
        TransactionManager.runInTransaction(true, Util.prototype.geTransaction, util);
      transaction1.marker1 = true;
      transaction1.must.not.be.undefined();
      const transaction2 =
        TransactionManager.runInTransaction(true, Util.prototype.geTransaction, util);
      demand(transaction2.marker1).be.undefined();
    });
  });
  describe('Transaction reuse', () => {
    it('Must reuse the existing transaction', () => {
      TransactionManager.runInTransaction(true, Util.prototype.checkTransactionReused, util);
    });
    it('Can execute a readonly transaction inside of a readwrite one', () => {
      TransactionManager.runInTransaction(false, Util.prototype.runMethod1InReadonly, util);
    });
    it('Can\'t execute a readwrite transaction inside of a readonly one', () => {
      try {
        TransactionManager.runInTransaction(true, Util.prototype.runMethod1InReadWrite, util);
        true.must.be.false();
      } catch (e) {
        e.must.be.an.error('Couldn\'t upgrade transaction from read only to read write');
      }
    });
  });
  describe('Lifecycle', () => {
    it('Must be started by the time it gets to the execution of the method', () => {
      TransactionManager.runInTransaction(true, Util.prototype.checkTransactionStarted, util);
    });
    it('Must commit a successful transaction', () => {
      TransactionManager.runInTransaction(true, Util.prototype.setListeners, util, [true]);
      util.committed.must.be.true();
      util.rolledBack.must.be.false();
    });
    it('Must rollback a failed transaction', () => {
      try {
        TransactionManager.runInTransaction(true, Util.prototype.setListeners, util, [false]);
        true.must.be.false();
      } catch (e) {
        e.must.be.an.error(/Faking error/);
      }
      util.committed.must.be.false();
      util.rolledBack.must.be.true();
    });
  });
});
