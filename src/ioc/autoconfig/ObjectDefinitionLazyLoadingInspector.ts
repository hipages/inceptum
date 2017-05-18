import {AbstractObjectDefinitionInspector } from '../AbstractObjectDefinitionInspector';
import { SingletonDefinition } from '../objectdefinition/SingletonDefinition';

export class ObjectDefinitionLazyLoadingInspector extends AbstractObjectDefinitionInspector {
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
