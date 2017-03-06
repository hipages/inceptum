/* eslint-disable space-before-function-paren */
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

  doWrap /* istanbul ignore next */ (underlyingInstance) {
    throw new Error(`Unimplemented doWrap(${underlyingInstance})`);
  }

  * lcStart /* istanbul ignore next */ () {
    return yield* this.wrapped.lcStart();
  }

  * lcStop /* istanbul ignore next */ () {
    return yield* this.wrapped.lcStop();
  }

  withLazyLoading /* istanbul ignore next */ (lazyLoading) {
    return this.wrapped.withLazyLoading(lazyLoading);
  }

  setAutowireCandidate /* istanbul ignore next */ (autowireCandidate) {
    return this.wrapped.setAutowireCandidate(autowireCandidate);
  }

  setContext /* istanbul ignore next */ (context) {
    return this.wrapped.setContext(context);
  }

  getContext /* istanbul ignore next */ () {
    return this.wrapped.getContext();
  }

  getProducedClass /* istanbul ignore next */ () {
    return this.wrapped.getProducedClass();
  }

  isLazy /* istanbul ignore next */ () {
    return this.wrapped.isLazy();
  }

  getName /* istanbul ignore next */ () {
    return this.wrapped.getName();
  }

  getLogger /* istanbul ignore next */ () {
    return this.wrapped.getLogger();
  }

  onState /* istanbul ignore next */ (stateId, callback) {
    return this.wrapped.onState(stateId, callback);
  }

  setLogger /* istanbul ignore next */ (logger) {
    return this.wrapped.setLogger(logger);
  }

  assertState /* istanbul ignore next */ (state) {
    return this.wrapped.assertState(state);
  }

  onStateOnce /* istanbul ignore next */ (stateId, callback) {
    return this.wrapped.onStateOnce(stateId, callback);
  }

  * getInstanceAtState /* istanbul ignore next */ (...args) {
    const underlyingInstance = yield this.wrapped.getInstanceAtState(...args);
    return this.doWrap(underlyingInstance);
  }

  * getInstanceWithTrace /* istanbul ignore next */ (...args) {
    const underlyingInstance = yield this.wrapped.getInstanceWithTrace(...args);
    return this.doWrap(underlyingInstance);
  }
}

module.exports = { AbstractSingletonDefinitionWrapper };
