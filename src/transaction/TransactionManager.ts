
export class TransactionError extends Error {
}

export class Transaction {

  static idInc;
  
  id: number;
  readonly: Boolean;
  began: Boolean;
  finished: Boolean;
  error: Error;
  commitListeners: Array<(Transaction) => Promise<any>>;
  rollbackListeners: Array<(Transaction) => Promise<any>>;

  constructor(readonly: boolean) {
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

  /**
   * @return {Promise} A promise that executes all the callbacks necessary
   */
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

export class TransactionManager {

  static newTransaction(readonly) {
    return new Transaction(readonly);
  }
}
