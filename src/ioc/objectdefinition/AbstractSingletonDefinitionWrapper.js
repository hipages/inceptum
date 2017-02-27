const { IoCException } = require('./../IoCException');
const { SingletonDefinition } = require('./SingletonDefinition');

class AbstractSingletonDefinitionWrapper extends SingletonDefinition {
  constructor(wrapped) {
    if (!(wrapped instanceof SingletonDefinition)) {
      throw new IoCException(`Provided input is not a SingletonDefinition but a ${typeof wrapped}`);
    }
    super(wrapped.getProducedClass(), wrapped.getName(), wrapped.getLogger());
    this.wrapped = wrapped;
    this.cachedInstance = null;
  }

  * getInstance() {
    if (!this.cachedInstance) {
      const underlyingInstance = yield* this.wrapped.getInstance();
      this.cachedInstance = this.doWrap(underlyingInstance);
    }
    return this.cachedInstance;
  }

  doWrap(underlyingInstance) {
    throw new Error(`Unimplemented doWrap(${underlyingInstance})`);
  }

  * lcStart() {
    return yield* this.wrapped.lcStart();
  }

  * lcStop() {
    return yield* this.wrapped.lcStop();
  }


  withLazyLoading(lazyLoading) {
    return this.wrapped.withLazyLoading(lazyLoading);
  }

  setAutowireCandidate(autowireCandidate) {
    return this.wrapped.setAutowireCandidate(autowireCandidate);
  }

  setContext(context) {
    return this.wrapped.setContext(context);
  }

  getContext() {
    return this.wrapped.getContext();
  }

  getProducedClass() {
    return this.wrapped.getProducedClass();
  }

  isLazy() {
    return this.wrapped.isLazy();
  }

  getName() {
    return this.wrapped.getName();
  }

  getLogger() {
    return this.wrapped.getLogger();
  }

  onState(stateId, callback) {
    return this.wrapped.onState(stateId, callback);
  }

  setLogger(logger) {
    return this.wrapped.setLogger(logger);
  }

  lcStartSync(maxAwaitMillis) {
    return this.wrapped.lcStartSync(maxAwaitMillis);
  }

  assertState(state) {
    return this.wrapped.assertState(state);
  }

  waitFor(func, maxAwaitMillis, message) {
    return this.wrapped.waitFor(func, maxAwaitMillis, message);
  }

  onStateOnce(stateId, callback) {
    return this.wrapped.onStateOnce(stateId, callback);
  }
}

module.exports = { AbstractSingletonDefinitionWrapper };
