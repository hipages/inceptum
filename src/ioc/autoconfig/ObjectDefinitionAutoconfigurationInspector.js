const { AbstractObjectDefinitionInspector } = require('../AbstractObjectDefinitionInspector');
const { SingletonDefinition } = require('../objectdefinition/SingletonDefinition');

class ObjectDefinitionAutoconfigurationInspector extends AbstractObjectDefinitionInspector {
  interestedIn(objectDefinition) {
    return (objectDefinition instanceof SingletonDefinition) && (objectDefinition.getProducedClass().autowire !== undefined);
  }

  doInspect(objectDefinition) {
    const autowire = objectDefinition.getProducedClass().autowire;
    if (autowire.constructor) {
      autowire.constructor.forEach((val) => {
        switch (val.substr(0, 1)) {
          case '~':
            objectDefinition.constructorParamByType(val.substr(1));
            break;
          // case '*':
          //   objectDefinition.setPropertyByTypeArray(key, val.substr(1));
          //   break;
          case '#':
            // This is for config
            break;
          default:
            // By Name
            objectDefinition.constructorParamByRef(val);
        }
      });
    }
    Object.keys(autowire).filter((key) => key !== 'constructor').forEach((key) => {
      const val = autowire[key];
      switch (val.substr(0, 1)) {
        case '~':
          objectDefinition.setPropertyByType(key, val.substr(1));
          break;
        case '*':
          objectDefinition.setPropertyByTypeArray(key, val.substr(1));
          break;
        case '#':
          // This is for config
          break;
        default:
          // By Name
          objectDefinition.setPropertyByRef(key, val);
      }
    });
  }
}

module.exports = { ObjectDefinitionAutoconfigurationInspector };


// Private methods:
const ProtectedActions = {
  createSingletonDefinition(clazz) {
    const def = new SingletonDefinition(clazz);
    if (clazz.dependencies) {
      Object.keys(clazz.dependencies).forEach((key) => {
        const val = clazz.dependencies[key];
        switch (val.substr(0, 1)) {
          case '~':
            def.setPropertyByType(key, val.substr(1));
            break;
          case '*':
            def.setPropertyByTypeArray(key, val.substr(1));
            break;
          case '#':
            // This is for config
            break;
          default:
            // By Name
            def.setPropertyByRef(key, val.substr(1));
        }
      });
    }
    return def;
  }
};