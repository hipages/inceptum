const { AbstractObjectDefinitionInspector } = require('../ioc/AbstractObjectDefinitionInspector');
const { SingletonDefinition } = require('../ioc/objectdefinition/SingletonDefinition');

class ControllerObjectDefinitionInspector extends AbstractObjectDefinitionInspector {
  interestedIn(objectDefinition) {
    return (objectDefinition instanceof SingletonDefinition) && (objectDefinition.getProducedClass().routes !== undefined);
  }

  doInspect(objectDefinition) {
    // Let's mark this as non-lazy
    objectDefinition.withLazyLoading(false);
    const routes = objectDefinition.getProducedClass().routes;
    const owningContext = objectDefinition.getContext();
    const router = owningContext.getDefinitionByType('MainRouter');
    if (!router) {
      throw new Error('Couldn\'t find an instance of MainRouter. Can\'t autowire controller routes');
    }
    console.log('Doing the routing magic for ', routes);
  }
}

module.exports = { ControllerObjectDefinitionInspector };
