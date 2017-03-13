const { SingletonDefinition } = require('./SingletonDefinition');

class PreinstantiatedSingletonDefinition extends SingletonDefinition {
  constructor(instance, name, logger) {
    if (typeof instance !== 'object') {
      throw new Error(`Only objects can be used as preinstatiated objects. Provided a ${typeof instance} for Object Definition ${name}`);
    }
    super(instance.constructor, name, logger);
    this.instance = instance;
    this.withLazyLoading(false);
  }

  getInstance() {
    return Promise.resolve(this.instance);
  }

// eslint-disable-next-line no-empty-function
  doStart() {
  }

// eslint-disable-next-line no-empty-function
  doStop() {
  }
}

module.exports = { PreinstantiatedSingletonDefinition };
