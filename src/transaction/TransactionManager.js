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
      const result = listeners[i](this);
      if (result) {
        yield result;
      }
    }
  }
}
Transaction.idInc = 1;

class TransactionManager {

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
  }

  static withTransaction(fn, ctx) {
    return co.withSharedContext((sharedContext) =>
      fn.call(ctx, sharedContext.currentTransaction));
  }
}
TransactionManager.Events = TransactionEvents;

module.exports = { TransactionManager, TransactionError };
