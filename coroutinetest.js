
// const { createNamespace } = require('continuation-local-storage');

class CoroutineRunner {
  static isIterator(obj) {
    return obj && !(obj instanceof Function) && (obj.next instanceof Function);
  }
  static isPromise(obj) {
    return (obj !== undefined) && (obj.then || (obj instanceof Promise));
  }
  static execute(iterator, transaction) {
    console.log(`*** Entering execute with iterator ${iterator.name} and transaction ${transaction ? transaction.id : 'N/A'}`);
    function id(x) { return x; }
    function iterate(value) {
      console.log(`* Calling next with ${value} - ${iterator.name}`);
      const next = iterator.next(value);
      const request = next.value;
      const nextAction = next.done ? id : iterate;
      console.log(`* Got Done: ${next.done}, value: ${next.value} - ${iterator.name}`);

      if (CoroutineRunner.isIterator(request)) {
        console.log(`* Got iterator called ${request.name}`);
        const execResult = CoroutineRunner.execute(request, transaction);
        if (execResult && execResult.then) {
          return execResult.then(nextAction);
        }
        return nextAction(execResult);
      } else if (CoroutineRunner.isPromise(request)) {
        return request.then(nextAction);
      } else if (request && request.withTransaction) {
        const v = request.withTransaction(transaction);
        console.log(`* After with Transaction >${v}< >${nextAction}< - ${iterator.name}`);
        return nextAction(v);
      }
      return request;
    }
    return iterate();
  }
}

function inTransaction(f) {
  return { withTransaction: f };
}

function* giveDelayedAction(resp) {
  return inTransaction((transaction) => {
    console.log(`Doing action with transaction ${transaction ? transaction.id : 'N/A'} ${resp}`);
    return resp;
  });
}

function nameIt(name, iterator) {
  iterator.name = name;
  return iterator;
}

function* doSomethingFirst() {
  console.log('Doing something first');
  const resp = yield nameIt('giveDelayedAction1', giveDelayedAction('done 1'));
  console.log(`Done ${resp}`);
  const resp2 = yield nameIt('giveDelayedAction2', giveDelayedAction('done 2'));
  console.log(`Done ${resp2}`);
  return resp;
}

CoroutineRunner.execute(nameIt('doSomethingFirst', doSomethingFirst()), {id: 1});
//
// return;
//
// async function exagerate(input) {
//   return `"${input} for transaction ${namespace.get('transaction').id}"`;
// }
// async function doAsyncStuff(input) {
//   const exaggerated = await exagerate(input);
//   return `Not really async... just got ${exaggerated}`;
// }
//
// async function startTransaction() {
//   namespace.get('transaction').started = true;
//   console.log('Started transaction');
// }
//
// let idGen = 1;
// const namespace = createNamespace('sdsd');
//
// function getTransaction() {
//   return namespace.get('transaction');
// }
//
// function getTransactionId() {
//   const t = getTransaction();
//   return t ? t.id : undefined;
// }
//
// function wrapInPromise(f) {
//   if (f instanceof Promise) {
//     return f;
//   }
//   return new Promise((resolve, reject) => {
//     try {
//       resolve(f());
//     } catch (e) {
//       reject(e);
//     }
//   })
// }
//
// async function runPromiseInTransaction(func) {
//   console.log(`Running in transaction id ${getTransactionId()}`);
//   if (getTransaction()) {
//     if (func instanceof Function) {
//       return await func();
//     }
//     return await func;
//   }
//   return namespace.runAndReturn(async function() {
//     const transaction = { id: idGen++ };
//     namespace.set('transaction', transaction);
//     await runQuery('BEGIN TRANSACTION');
//     try {
//       let resp;
//       if (func instanceof Function) {
//         let resp = await func();
//       } else {
//         resp = await func;
//       }
//       // const resp = await func;
//       await runQuery('COMMIT');
//       return resp;
//     } catch (e) {
//       console.log(`Got error ${e}`);
//       await runQuery('ROLLBACK');
//     }
//   });
// }
//
//
// async function runQuery(sql) {
//   return await runPromiseInTransaction(() => runQueryInternal(sql));
// }
//
// function runQueryInternal(sql) {
//   console.log(`Running query ${sql} in  ${getTransactionId()}`);
//   return new Promise((resolv) => setTimeout(resolv, 1000, 1, 2, 3));
// }
//
//
// runQuery('SELECT 1');

//
// namespace.runAndReturn( () => {
//   namespace.set('transaction', transaction);
//   return startTransaction().then(doAsyncStuff('Paolo')
// } ).then(console.log);

// CoroutineRunner.execute(doSomethingFirst(), { id: 1 });
