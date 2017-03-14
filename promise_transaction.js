//require('./src/util/BluePatch');
const cls = require('continuation-local-storage');

const transactionNS = cls.createNamespace('transaction');

class Transaction {
  constructor() {
    this.id = Transaction.idGen++;
  }
  begin() {
    console.log(`Starting transaction ${this.id}`);
  }
  end() {
    console.log(`Ending transaction ${this.id}`);
  }
}
Transaction.idGen = 0;

function checkTransaction() {
  console.log(`Just checking: ${TransactionManager.getId()}`);
}


class TransactionManager {
  static runInTransaction(func, context, argArr) {
    if (transactionNS.active) {
      console.log(`Calling ${func.name} directly`);
      return func.call(context, argArr);
    }
    return transactionNS.runAndReturn(() => {
      console.log(`Calling ${func.name} in transaction`);
      const transaction = new Transaction();
      transactionNS.set('transaction', transaction);
      transaction.begin();
      checkTransaction();
      return transactionNS.runAndReturn(() => func.apply(context, argArr))
        .then(() => transaction.end());
    });
  }
  static getCurrentTransaction() {
    return transactionNS.get('transaction');
  }
  static getId() {
    const transaction = TransactionManager.getCurrentTransaction();
    return transaction ? transaction.id : 'N/A';
  }
  static wrap(instance, methodName) {
    const oldMethod = instance[methodName];
    instance[methodName] = (...args) => {
      return TransactionManager.runInTransaction(oldMethod, instance, args);
    };
  }
}

class TheOneThatNeedsTheTransaction {
  doInTransaction(sql) {
    console.log(`Synchronously, in doInTransaction, it is ${TransactionManager.getId()}`)
    return Promise.resolve(`Doing ${sql} in transaction ${TransactionManager.getId()}`);
  }
}

class TheClassToRun {
  doSomethingThatWorksForOne(testId) {
    console.log(`${testId} Doing something... here transaction is ${TransactionManager.getId()}`)
    return this.doer.doInTransaction('First SQL')
      .then((result) => console.log(`${testId} First result: ${result}`))
      .then(() => this.doer.doInTransaction('Second SQL'))
      .then((result) => console.log(`${testId} Second result: ${result}`));
  }

  doSomethingThatWorksForNone(testId) {
    console.log(`${testId} Doing something... here transaction is ${TransactionManager.getId()}`)
    return Promise.resolve('First SQL')
      .then((sql) => this.doer.doInTransaction(sql))
      .then((result) => console.log(`${testId} First result: ${result}`))
      .then(() => this.doer.doInTransaction('Second SQL'))
      .then((result) => console.log(`${testId} Second result: ${result}`));
  }
}


const theClassToRun = new TheClassToRun();
TransactionManager.wrap(theClassToRun, 'doSomethingThatWorksForOne');
TransactionManager.wrap(theClassToRun, 'doSomethingThatWorksForNone');

const theOneThatNeedsTheTransaction = new TheOneThatNeedsTheTransaction();
theClassToRun.doer = theOneThatNeedsTheTransaction;
console.log('********* doSomethingThatWorksForNone');
theClassToRun.doSomethingThatWorksForNone('A');
//  .then(() => console.log('********* doSomethingThatWorksForOne'))
//  .then(() => theClassToRun.doSomethingThatWorksForOne());
theClassToRun.doSomethingThatWorksForOne('B');
setTimeout(() => { console.log('Done'); }, 100);
