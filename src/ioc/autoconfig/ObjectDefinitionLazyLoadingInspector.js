const { AbstractObjectDefinitionInspector } = require('../AbstractObjectDefinitionInspector');
const { SingletonDefinition } = require('../objectdefinition/SingletonDefinition');

class ObjectDefinitionLazyLoadingInspector extends AbstractObjectDefinitionInspector {
  interestedIn(objectDefinition) {
    return (objectDefinition instanceof SingletonDefinition)
      && objectDefinition.getProducedClass().lazy !== undefined;
  }

  /**
   * @param {SingletonDefinition} objectDefinition singleton definition
   */
  doInspect(objectDefinition) {
    objectDefinition.withLazyLoading(objectDefinition.getProducedClass().lazy);
  }
}

module.exports = { ObjectDefinitionLazyLoadingInspector };
