const co = require('co');

class TransactionError extends Error {
}

const TransactionEvents = {
  START: 'started',
  ROLLBACK: 'rollback',
  COMMIT: 'commit',
  END: 'end'
};

class Transaction {
  constructor(readonly) {
    this.id = Transaction.idInc++;
    this.readonly = readonly;
    this.began = false;
    this.finished = false;
    this.error = null;
    this.commitListeners = [];
    this.rollbackListeners = [];
  }
  begin() {
    if (this.began) {
      throw new TransactionError('Transaction is already started');
    }
    this.began = true;
  }
  hasBegun() {
    return this.began;
  }
  markError(e) {
    this.error = e;
  }
  addCommitListener(f) {
    this.commitListeners.push(f);
  }
  addRollbackListener(f) {
    this.rollbackListeners.push(f);
  }
  * end() {
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
      yield this.callListeners(this.rollbackListeners);
    } else {
      yield this.callListeners(this.commitListeners);
    }
  }
  canDo(readonly) {
    return !this.readonly || readonly;
  }
  isReadonly() {
    return this.readonly;
  }

  * callListeners(listeners) {
    for (let i = 0; i < listeners.length; i++) {
      yield listeners[i](this);
    }
  }
}
Transaction.idInc = 1;

// function doTransactionEnd(newTransaction, transactionalNamespace) {
//   newTransaction.end();
//   console.log('Clearing transaction');
//   transactionalNamespace.set('transaction', undefined);
// }

class TransactionManager {

  static* getCurrentTransaction() {
    return co.withSharedContext((context) => context.currentTransaction);
  }

  static* runInTransaction(readonly, callback, callbackContext, args) {
    return co.withSharedContext(function* (context) {
      if (!context.currentTransaction) {
        context.currentTransaction = new Transaction(readonly);
        try {
          context.currentTransaction.begin();
          return yield callback.apply(callbackContext, args);
        } catch (e) {
          context.currentTransaction.markError(e);
          throw e;
        } finally {
          yield context.currentTransaction.end();
          context.currentTransaction = undefined;
        }
      } else if (!context.currentTransaction.canDo(readonly)) {
        throw new TransactionError('Can\'t execute a readwrite transaction inside of an already started readonly one');
      } else {
        return yield callback.apply(callbackContext, args);
      }
    });
    //
    // if (CoroutineRunner.isIterator(callback)) {
    //   console.log('Given an iterator');
    //   return TransactionManager.runInTransaction(readonly, () => CoroutineRunner.execute(callback, transactionalNamespace), context, args);
    // }
    // if (CoroutineRunner.isPromise(callback)) {
    //   return TransactionManager.runInTransaction(readonly, function* () {
    //     yield callback;
    //   }, context, args);
    // }
    // // console.log('Given a function');
    // const existingTransaction = TransactionManager.getCurrentTransaction();
    // if (existingTransaction) {
    //   // console.log(`Existing transaction ${existingTransaction.id}`);
    //   if (!existingTransaction.canDo(readonly)) {
    //     throw new TransactionError('Couldn\'t upgrade transaction from read only to read write');
    //   }
    //   return callback.apply(context, args);
    // }
    // return transactionalNamespace.runAndReturn(
    //   () => {
    //     const newTransaction = new Transaction(readonly);
    //     console.log(`Running with transaction id: ${newTransaction.id}`);
    //     transactionalNamespace.set('transaction', newTransaction);
    //     let delayedEnd = false;
    //     try {
    //       newTransaction.begin();
    //       const resp = callback.apply(context, args);
    //       console.log(resp);
    //       if (CoroutineRunner.isIterator(resp)) {
    //         console.log('It was a generator, so executing coroutine');
    //         const t = CoroutineRunner.execute(resp, transactionalNamespace, newTransaction);
    //         if (CoroutineRunner.isPromise(t)) {
    //           console.log('Delaying end of transaction until completion of promise');
    //           delayedEnd = true;
    //           return t.then((data) => {
    //             console.log('Doing delayed end of transaction')
    //             doTransactionEnd(newTransaction, transactionalNamespace);
    //             return data;
    //           }).catch((err) => {
    //             newTransaction.markError(err);
    //             doTransactionEnd(newTransaction, transactionalNamespace);
    //             throw err;
    //           });
    //         }
    //         return t;
    //       } else if (CoroutineRunner.isPromise(resp)) {
    //         console.log('It IS a promise');
    //         delayedEnd = true;
    //         return resp.then((data) => {
    //           console.log('Doing delayed end of transaction')
    //           doTransactionEnd(newTransaction, transactionalNamespace);
    //           return data;
    //         }).catch((err) => {
    //           console.log(err);
    //           newTransaction.markError(err);
    //           doTransactionEnd(newTransaction, transactionalNamespace);
    //           throw err;
    //         });
    //       }
    //       return resp;
    //     } catch (e) {
    //       newTransaction.markError(e);
    //       throw e;
    //     } finally {
    //       if (!delayedEnd) {
    //         // console.log(`Ending transaction ${newTransaction.id}`);
    //         doTransactionEnd(newTransaction, transactionalNamespace);
    //       }
    //       console.log('End of transactional run and return');
    //     }
    //   }
    // );
  }

  // static transactionExists() {
  //   return TransactionManager.getCurrentTransaction() !== undefined;
  // }
  // static getCurrentTransaction() {
  //   return transactionalNamespace.get('transaction');
  // }
}
TransactionManager.id = 0;
TransactionManager.Events = TransactionEvents;

module.exports = { TransactionManager, TransactionError };
