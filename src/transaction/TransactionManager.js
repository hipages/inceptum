const cls = require('continuation-local-storage');

const transactionNS = cls.createNamespace('transaction');

const TRANSACTION_KEY = 'TRANSACTION___KEY';

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
    if (!f || !(f instanceof Function)) {
      throw new TransactionError('Provided input to addCommitListener is not a function');
    }
    this.commitListeners.push(f);
  }
  addRollbackListener(f) {
    if (!f || !(f instanceof Function)) {
      throw new TransactionError('Provided input to addRollbackListener is not a function');
    }
    this.rollbackListeners.push(f);
  }
  end() {
    if (!this.began) {
      // console.log('Transaction never got started, so can\'t be finished');
      return Promise.reject(new TransactionError('Transaction never got started, so can\'t be finished'));
    }
    if (this.finished) {
      // console.log('Transaction is already finished');
      return Promise.reject(new TransactionError('Transaction is already finished'));
    }
    this.finished = true;
    if (this.error) {
      // console.log(`Emitting rollback for ${this.error} ${this.error.stack}`);
      return this.callListeners(this.rollbackListeners);
    }
    return this.callListeners(this.commitListeners);
  }
  canDo(readonly) {
    return !this.readonly || readonly;
  }
  isReadonly() {
    return this.readonly;
  }

  callListeners(listeners) {
    if (listeners && listeners.length > 0) {
      return Promise.all(listeners.map((listener) => listener(this)).filter((resp) => !!resp));
    }
    return Promise.resolve();
    // for (let i = 0; i < listeners.length; i++) {
    //   const result = listeners[i](this);
    //   if (result && result.then) {
    //     throw new TransactionError(`${type} listener returned a promise. Callbacks are expected to be synchronous`);
    //   }
    // }
  }
}
Transaction.idInc = 1;

class TransactionManager {

  static runInTransaction(readonly, callback, callbackContext, args) {
    if (transactionNS.active) {
      // We're already inside of an active transaction namespace context. Transaction has been set.
      // Let's check that readonly flags match
      const currentTransaction = TransactionManager.getCurrentTransaction();
      if (!currentTransaction) {
        throw new TransactionError('Found an active transaction namespace with no transaction in it! Shouldn\'t happen.' +
          ' Debug right now or risk the fabric of reality breaking');
      }
      if (!currentTransaction.canDo(readonly)) {
        throw new TransactionError('Can\'t execute a readwrite transaction inside of an already started readonly one');
      }
      return callback.apply(callbackContext, args);
    }
    // No active transaction... let's set it up
    return transactionNS.runAndReturn(() => {
      const currentTransaction = new Transaction(readonly);
      transactionNS.set(TRANSACTION_KEY, currentTransaction);
      currentTransaction.begin();
      console.log('Starting transaction');
// eslint-disable-next-line no-undef
      return PromiseUtil.try(() => {
        const result = transactionNS.bind(callback).apply(callbackContext, args);
        if (result && !result.then) {
          throw new TransactionError(`Wrapped method (${callback.name}) didn't return a promise. Only methods that return` +
            ' a promise can be transactional or making them transactional would change their semantics');
        }
        return result;
      })
      .catch((err) => {
        currentTransaction.markError(err);
        throw err;
      })
      .finally(() => currentTransaction.end());
      // return new Promise((resolve, reject) => {
      //   let exception;
      //   let syncProcessing = true;
      //   try {
      //     const result = ;
      //     if (result && result.then) {
      //       syncProcessing = false;
      //       result.catch((err) => {
      //         currentTransaction.markError(err);
      //         reject(err);
      //       }).finally(() => {
      //         currentTransaction.end();
      //       })
      //       return;
      //     }
      //     reject(new TransactionError(`Wrapped method (${callback.name}) didn't return a promise. Only methods that return` +
      //       ' a promise can be transactional or making them transactional would change their semantics'));
      //   } catch (e) {
      //     currentTransaction.markError(e);
      //     exception = e;
      //   } finally {
      //     if (syncProcessing) {
      //       currentTransaction.end();
      //     }
      //   }
      //   if (syncProcessing && exception) {
      //     reject(exception);
      //   }
      // });
    });
  }

  static getCurrentTransaction() {
    return transactionNS.active && transactionNS.get(TRANSACTION_KEY);
  }

  static hasTransaction() {
    return !!TransactionManager.getCurrentTransaction();
  }
}
TransactionManager.Events = TransactionEvents;

module.exports = { TransactionManager, TransactionError };
