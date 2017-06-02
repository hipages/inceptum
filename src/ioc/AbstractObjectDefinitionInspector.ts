import { ObjectDefinition } from './objectdefinition/ObjectDefinition';
import { ObjectDefinitionInspector } from './ObjectDefinitionInspector';

export type NameOrRegexp = string | RegExp;

export abstract class AbstractObjectDefinitionInspector implements ObjectDefinitionInspector {
  namePatterns: NameOrRegexp[];
  inspectAll: boolean;
  relevantClasses: Function[];

  constructor() {
    this.relevantClasses = [];
    this.namePatterns = [];
    this.inspectAll = false;
  }

  addInterestedClass(clazz: Function) {
    this.relevantClasses.push(clazz);
  }

  addNamePattern(nameOrRegex: NameOrRegexp) {
    this.namePatterns.push(nameOrRegex);
  }

  inspect(objectDefinition: ObjectDefinition<any>) {
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
  interestedIn(objectDefinition: ObjectDefinition<any>) {
    if (this.inspectAll) {
      return true;
    }
    const relevantClass = this.relevantClasses.find((clazz) => objectDefinition.getProducedClass() === clazz);
    if (relevantClass) {
      return true;
    }
    const relevantPattern = this.namePatterns.find((nameOrPattern) => {
      if (nameOrPattern instanceof RegExp) {
        if (nameOrPattern.test(objectDefinition.getName())) {
          return true;
        }
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

  setInspectAll(inspectAll: boolean) {
    this.inspectAll = inspectAll;
  }

  /**
   * If the {@link interestedIn} method returns true, this one will be called to provide
   * the modified version of the bean definition.
   * @param {ObjectDefinition} objectDefinition The object definition to possibly modify
   * @return ObjectDefinition The modified ObjectDefinition
   */
  abstract doInspect(objectDefinition: ObjectDefinition<any>);
}
