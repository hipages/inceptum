const { Lifecycle } = require('./../Lifecycle');
const LogManager = require('../../log/LogManager');

class ObjectDefinition extends Lifecycle {
  constructor(clazz, name, logger) {
    super(name || clazz.name, logger || LogManager.getLogger(__filename));
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

  isAutowireCandidate() {
    return this.autowireCandidate;
  }

  copy() {
    const theCopy = new ObjectDefinition(this.clazz, this.name, this.logger);
    this.copyInternalProperties(theCopy);
    return theCopy;
  }

  copyInternalProperties(copyTo) {
    copyTo.lazyLoading = this.lazyLoading;
    copyTo.autowireCandidate = this.autowireCandidate;
    copyTo.context = null;  // The copy must not inherit the context
  }
}

module.exports = { ObjectDefinition };
