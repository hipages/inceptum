const { ObjectDefinitionInspector } = require('./ObjectDefinitionInspector');

class AbstractObjectDefinitionInspector extends ObjectDefinitionInspector {
  constructor() {
    super();
    this.anyClass = [];
    this.namePatterns = [];
    this.inspectAll = false;
  }

  addInterestedClass(clazz) {
    this.anyClass.push(clazz);
  }

  addNamePattern(nameOrRegex) {
    this.namePatterns.push(nameOrRegex);
  }

  inspect(objectDefinition) {
    if (this.interestedIn(objectDefinition)) {
      return this.doInspect(objectDefinition);
    }
    return null;
  }

  /**
   * Indicates whether this inspector is interested in this ObjectDefinition
   * @param objectDefinition ObjectDefinition The object definition to possibly modify
   * @return boolean Whether it's interested or not in this ObjectDefinition
   */
  interestedIn(objectDefinition) {
    if (this.inspectAll) {
      return true;
    }
    const relevantClass = this.anyClass.find((clazz) => objectDefinition.getProducedClass() === clazz);
    if (relevantClass) {
      return true;
    }
    const relevantPattern = this.namePatterns.find((nameOrPattern) => {
      if (nameOrPattern instanceof RegExp) {
        if (nameOrPattern.test(objectDefinition.getName())) return true;
      } else if (nameOrPattern === objectDefinition.getName()) {
        return true;
      }
      return false;
    });
    if (relevantPattern) {
      return true;
    }
    return false;
  }

  /**
   * If the {@link interestedIn} method returns true, this one will be called to provide
   * the modified version of the bean definition.
   * @param {ObjectDefinition} objectDefinition The object definition to possibly modify
   * @return ObjectDefinition The modified ObjectDefinition
   */
  doInspect(objectDefinition) {
    throw new Error(`Unimplemented modify(${typeof objectDefinition})`);
  }

  setInspectAll(inspectAll) {
    this.inspectAll = inspectAll;
  }
}

module.exports = { AbstractObjectDefinitionInspector };
