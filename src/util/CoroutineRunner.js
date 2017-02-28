class CoroutineRunner {
  static isIterator(obj) {
    return obj && !(obj instanceof Function) && (obj.next instanceof Function);
  }
  static isPromise(obj) {
    return (obj !== undefined) && (obj.then || (obj instanceof Promise));
  }
  static execute(iterator, options) {
    function id(x) { return x; }
    function iterate(value) {
      const next = iterator.next(value);
      const request = next.value;
      const nextAction = next.done ? id : iterate;

      if (CoroutineRunner.isIterator(request)) {
        return CoroutineRunner.execute(request, options).then(nextAction);
        // } else if (isQuery(request)) {
        //   return request.execWithin(options.tx).then(nextAction)
      } else if (CoroutineRunner.isPromise(request)) {
        return request.then(nextAction);
      }
      return request;
    }
    return iterate();
  }
}

module.exports = { CoroutineRunner };
