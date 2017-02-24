const { AbstractObjectDefinitionInspector } = require('../ioc/AbstractObjectDefinitionInspector');
const { Controller } = require('./Controller');

class ControllerObjectDefinitionInspector extends AbstractObjectDefinitionInspector {
  constructor() {
    super();
    this.addInterestedClass(Controller);
  }

  doInspect(objectDefinition) {
    const owningContext = objectDefinition.getContext();
    const router = owningContext.getObjectDefinitionByType('Router');
    if (!router) {
      throw new Error('');
    }
  }
}

module.exports = { ControllerObjectDefinitionInspector };
