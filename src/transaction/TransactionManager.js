const EventEmitter = require('events');
const { createNamespace } = require('continuation-local-storage');
const { CoroutineRunner } = require('../util/CoroutineRunner');

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
    this.id = Transaction.idInc++;
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
      // console.log('Transaction never got started, so can\'t be finished');
      throw new TransactionError('Transaction never got started, so can\'t be finished');
    }
    if (this.finished) {
      // console.log('Transaction is already finished');
      throw new TransactionError('Transaction is already finished');
    }
    this.finished = true;
    if (this.error) {
      // console.log(`Emitting rollback for ${this.error} ${this.error.stack}`);
      this.emit(TransactionEvents.ROLLBACK);
    } else {
      // console.log('Emitting commit');
      // console.log(TransactionEvents.COMMIT);
      // console.log(this.listeners(TransactionEvents.COMMIT));
      this.emit(TransactionEvents.COMMIT, {});
    }
    this.emit(TransactionEvents.END, {});
  }
  canDo(readonly) {
    return !this.readonly || readonly;
  }
  isReadonly() {
    return this.readonly;
  }
}
Transaction.idInc = 1;

function doTransactionEnd(newTransaction, transactionalNamespace) {
  newTransaction.end();
  transactionalNamespace.set('transaction', undefined);
}

class TransactionManager {
  static runInTransaction(readonly, callback, context, args) {
    if (CoroutineRunner.isIterator(callback)) {
      // console.log('Given an iterator');
      return TransactionManager.runInTransaction(readonly, () => {
        CoroutineRunner.execute(callback);
      }, context, args);
    }
    if (CoroutineRunner.isPromise(callback)) {
      return TransactionManager.runInTransaction(readonly, function* () {
        yield callback;
      }, context, args);
    }
    // console.log('Given a function');
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
        // console.log(`Running with transaction id: ${newTransaction.id}`);
        transactionalNamespace.set('transaction', newTransaction);
        let delayedEnd = false;
        try {
          newTransaction.begin();
          const resp = callback.apply(context, args);
          // console.log(resp.next);
          if (CoroutineRunner.isIterator(resp)) {
            // console.log('It was a generator, so executing coroutine');
            const t = CoroutineRunner.execute(resp);
            if (CoroutineRunner.isPromise(t)) {
              // console.log('Delaying end of transaction until completion of promise');
              delayedEnd = true;
              return t.then((data) => {
                // console.log('Doing delayed end of transaction')
                doTransactionEnd(newTransaction, transactionalNamespace);
                return data;
              }).catch((err) => {
                newTransaction.markError(err);
                doTransactionEnd(newTransaction, transactionalNamespace);
              });
            }
            return t;
          }
          return resp;
        } catch (e) {
          newTransaction.markError(e);
          throw e;
        } finally {
          if (!delayedEnd) {
            // console.log(`Ending transaction ${newTransaction.id}`);
            doTransactionEnd(newTransaction, transactionalNamespace);
          }
        }
      }
    );
  }

  static transactionExists() {
    return TransactionManager.getCurrentTransaction() !== undefined;
  }
  static getCurrentTransaction() {
    return transactionalNamespace.get('transaction');
  }
}
TransactionManager.id = 0;
TransactionManager.Events = TransactionEvents;

module.exports = { TransactionManager };
