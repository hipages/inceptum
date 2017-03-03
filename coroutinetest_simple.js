function id(x) { return x; }

class CoroutineRunner {
  static isIterator(obj) {
    return obj && !(obj instanceof Function) && (obj.next instanceof Function);
  }
  static isPromise(obj) {
    return (obj !== undefined) && (obj.then || (obj instanceof Promise));
  }
  static isAwaitingSharedContext(obj) {
    return (obj && obj.withSharedContext && (obj.withSharedContext instanceof  Function));
  }
  static executePromiseInternal(promise, nextAction) {
    return promise.then(nextAction);
  }
  static executeIteratorInternal(iterator, sharedContext, nextAction) {
    const execResult = CoroutineRunner.execute(iterator, sharedContext);
    if (CoroutineRunner.isPromise(execResult)) {
      return CoroutineRunner.executePromiseInternal(execResult);
    }
    return nextAction(execResult);
  }
  static execute(iterator, sharedContext = {}) {
    function iterate(value) {
      const next = iterator.next(value);
      const request = next.value;
      const nextAction = next.done ? id : iterate;
      if (CoroutineRunner.isIterator(request)) {
        return CoroutineRunner.executeIteratorInternal(request, sharedContext, nextAction);
      } else if (CoroutineRunner.isPromise(request)) {
        return CoroutineRunner.executePromiseInternal(request);
      } else if (request && request.withSharedContext) {
        const execResult = request.withSharedContext(sharedContext);
        if (CoroutineRunner.isIterator(execResult)) {
          return CoroutineRunner.executeIteratorInternal(execResult, sharedContext, nextAction);
        }
        return nextAction(execResult);
      }
      return request;
    }
    return iterate();
  }
}

function withSharedContext(f) {
  return { withSharedContext: f };
}

// END OF FRAMEWORK CODE

function* giveDelayedAction(resp) {
  return withSharedContext((sharedContext) => {
    console.log(`Doing action with transaction ${sharedContext ? sharedContext.transaction.id : 'N/A'}`);
    return resp;
  });
}

function* giveDelayedAction2(resp) {
  return withSharedContext(function* (sharedContext) {
    console.log(`Doing action2 with transaction ${sharedContext ? sharedContext.transaction.id : 'N/A'}`);
    const t = yield giveDelayedAction(resp);
    return t;
  });
}

function* setContextVal(key, val) {
  return withSharedContext(function* (sharedContext) {
    sharedContext[key] = val;
  });
}

function* validateContextVal(key, val) {
  return withSharedContext(function* (sharedContext) {
    if (val !== sharedContext[key]) {
      throw new Error('Unexpected value on context');
    }
  });
}

function* doSomethingFirst() {
  console.log('Doing something first');
  const resp = yield giveDelayedAction('done 1');
  console.log(`Done ${resp}`);
  const resp2 = yield giveDelayedAction2('done 2');
  console.log(`Done ${resp2}`);
  return resp;
}


function* checkPassedByRef() {
  const resp = yield setContextVal('ss', 'done 1');
  yield validateContextVal('ss', 'done 1');
  return resp;
}

const finalResult = CoroutineRunner.execute(checkPassedByRef(), { transaction: { id: 1 } });
console.log(`Final result: ${finalResult}`);

