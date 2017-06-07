import {AbstractObjectDefinitionInspector } from '../AbstractObjectDefinitionInspector';
import { SingletonDefinition } from '../objectdefinition/SingletonDefinition';

export class ObjectDefinitionStartStopMethodsInspector extends AbstractObjectDefinitionInspector {
  // tslint:disable-next-line:prefer-function-over-method
  interestedIn(objectDefinition) {
    return (objectDefinition instanceof SingletonDefinition)
      && (objectDefinition.getProducedClass().startMethod !== undefined
        || objectDefinition.getProducedClass().stopMethod !== undefined);
  }

  /**
   * @param {SingletonDefinition} objectDefinition singleton definition
   */
  // tslint:disable-next-line:prefer-function-over-method
  doInspect(objectDefinition) {
    const startMethodName = objectDefinition.getProducedClass().startMethod;
    if (startMethodName) {
      objectDefinition.startFunction(startMethodName);
    }
    const stopMethodName = objectDefinition.getProducedClass().stopMethod;
    if (stopMethodName) {
      objectDefinition.stopFunction(stopMethodName);
    }
  }
}
