const EventEmitter = require('events');
const { createNamespace } = require('continuation-local-storage');


const transactionalNamespace = createNamespace('transaction');

class TransactionError extends Error {
}

const TransactionEvents = {
  START: 'started',
  ROLLBACK: 'rollback',
  COMMIT: 'commit',
  END: 'end'
};

class Transaction extends EventEmitter {
  constructor(readonly) {
    super();
    this.readonly = readonly;
    this.began = false;
    this.finished = false;
    this.error = null;
  }
  begin() {
    if (this.began) {
      throw new TransactionError('Transaction is already started');
    }
    this.began = true;
    this.emit(TransactionEvents.START);
  }
  hasBegun() {
    return this.began;
  }
  markError(e) {
    this.error = e;
  }
  end() {
    if (!this.began) {
      throw new TransactionError('Transaction never got started, so can\'t be finished');
    }
    if (this.finished) {
      throw new TransactionError('Transaction is already finished');
    }
    this.finished = true;
    if (this.error) {
      this.emit(TransactionEvents.ROLLBACK);
    } else {
      this.emit(TransactionEvents.COMMIT);
    }
    this.emit(TransactionEvents.END);
  }
  canDo(readonly) {
    return !this.readonly || readonly;
  }
}

class TransactionManager {
  runInTransaction(readonly, callback, context, args) {
    const existingTransaction = TransactionManager.getCurrentTransaction();
    if (existingTransaction) {
      if (!existingTransaction.canDo(readonly)) {
        throw new TransactionError('Couldn\'t upgrade transaction from read only to read write');
      }
      return callback.apply(context, args);
    }
    return transactionalNamespace.runAndReturn(
      () => {
        const newTransaction = new Transaction(readonly);
        transactionalNamespace.set('transaction', newTransaction);
        try {
          newTransaction.begin();
          return callback.apply(context, args);
        } catch (e) {
          newTransaction.markError(e);
          throw e;
        } finally {
          newTransaction.end();
          transactionalNamespace.set('transaction', undefined);
        }
      }
    );
  }

  static transactionExists() {
    return TransactionManager.getCurrentTransaction() !== null;
  }
  static getCurrentTransaction() {
    return transactionalNamespace.get('transaction');
  }
}

TransactionManager.Events = TransactionEvents;

module.exports = { TransactionManager };
