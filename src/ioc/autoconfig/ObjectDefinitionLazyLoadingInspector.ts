import { AbstractObjectDefinitionInspector } from '../AbstractObjectDefinitionInspector';
import { SingletonDefinition } from '../objectdefinition/SingletonDefinition';

interface LazyInfoProvider {
  lazy: boolean,
}

export class ObjectDefinitionLazyLoadingInspector extends AbstractObjectDefinitionInspector {

  private static hasLazy(objectDefinition: SingletonDefinition<any>): boolean {
    return objectDefinition.getProducedClass().hasOwnProperty('lazy');
  }

  private static getLazy(objectDefinition: SingletonDefinition<any>): boolean {
    return (objectDefinition.getProducedClass()).lazy;
  }

  // tslint:disable-next-line:prefer-function-over-method
  interestedIn(objectDefinition) {
    if (!(objectDefinition instanceof SingletonDefinition)) {
      return false;
    }
    return ObjectDefinitionLazyLoadingInspector.hasLazy(objectDefinition);
  }

  /**
   * @param {SingletonDefinition} objectDefinition singleton definition
   */
  // tslint:disable-next-line:prefer-function-over-method
  doInspect(objectDefinition) {
    objectDefinition.withLazyLoading(ObjectDefinitionLazyLoadingInspector.getLazy(objectDefinition));
  }
}
