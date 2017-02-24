const { Lifecycle } = require('./../Lifecycle');

class ObjectDefinition extends Lifecycle {
  constructor(clazz, name, logger) {
    super(name || clazz.name, logger);
    this.clazz = clazz;
    this.lazyLoading = true;
    this.instance = null;
    this.autowireCandidate = true;
    this.context = null;
  }

  // ************************************
  // Configuration methods
  // ************************************

  withLazyLoading(lazyLoading) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.lazyLoading = lazyLoading;
    return this;
  }
  setAutowireCandidate(autowireCandidate) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.autowireCandidate = autowireCandidate;
    return this;
  }
  setContext(context) {
    this.assertState(Lifecycle.STATES.NOT_STARTED);
    this.context = context;
  }
  getContext() {
    return this.context;
  }

  // ************************************
  // Get instance methods
  // ************************************

  * getInstance() {
    yield null;
    throw new Error('Unimplemented');
  }

  // ************************************
  // Information methods
  // ************************************

  getProducedClass() {
    return this.clazz;
  }

  isLazy() {
    return this.lazyLoading;
  }
}

module.exports = { ObjectDefinition };
