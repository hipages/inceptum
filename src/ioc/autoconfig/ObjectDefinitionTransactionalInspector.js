const { AbstractObjectDefinitionInspector } = require('../AbstractObjectDefinitionInspector');
const { AbstractSingletonDefinitionWrapper } = require('../objectdefinition/AbstractSingletonDefinitionWrapper');
const { SingletonDefinition } = require('../objectdefinition/SingletonDefinition');
const { TransactionManager } = require('../../transaction/TransactionManager');

class TransactionSingletonDefinitionWrapper extends AbstractSingletonDefinitionWrapper {
  constructor(wrapped, transactionalInfo) {
    super(wrapped);
    this.transactionalInfo = transactionalInfo;
  }

  doWrap(underlyingInstance) {
    const info = this.transactionalInfo;
    return new Proxy(underlyingInstance, {
      get: (target, property) => {
        if (Object.prototype.hasOwnProperty.call(info, property)) {
          const readonly = info[property] !== 'readwrite';
          return function* (...args) {
            return yield TransactionManager.runInTransaction(readonly, target[property], target, args);
          };
        }
        return target[property];
      }
    });
  }
}

class ObjectDefinitionTransactionalInspector extends AbstractObjectDefinitionInspector {
  interestedIn(objectDefinition) {
    return (objectDefinition instanceof SingletonDefinition)
      && objectDefinition.getProducedClass().transactional !== undefined;
  }

  /**
   * @param {SingletonDefinition} objectDefinition singleton definition
   */
  doInspect(objectDefinition) {
    const transactionalInfo = objectDefinition.getProducedClass().transactional;
    return new TransactionSingletonDefinitionWrapper(objectDefinition, transactionalInfo);
  }
}

module.exports = { ObjectDefinitionTransactionalInspector };
