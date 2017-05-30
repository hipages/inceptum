import { AbstractObjectDefinitionInspector } from '../AbstractObjectDefinitionInspector';
import { SingletonDefinition } from '../objectdefinition/SingletonDefinition';

interface StartMethodProvider {
  startMethod: string,
}
interface StopMethodProvider {
  stopMethod: string,
}

export class ObjectDefinitionStartStopMethodsInspector extends AbstractObjectDefinitionInspector {

  private static hasStartMethod(objectDefinition: SingletonDefinition<any>): boolean {
    return objectDefinition.getProducedClass().hasOwnProperty('startMethod');
  }

  private static getStartMethod(objectDefinition: SingletonDefinition<any>): string {
    return (objectDefinition.getProducedClass() as any as StartMethodProvider).startMethod;
  }

  private static hasStopMethod(objectDefinition: SingletonDefinition<any>): boolean {
    return objectDefinition.getProducedClass().hasOwnProperty('stopMethod');
  }

  private static getStopMethod(objectDefinition: SingletonDefinition<any>): string {
    return (objectDefinition.getProducedClass() as any as StopMethodProvider).stopMethod;
  }

  interestedIn(objectDefinition) {
    return (objectDefinition instanceof SingletonDefinition)
      && (ObjectDefinitionStartStopMethodsInspector.hasStartMethod(objectDefinition)
        || ObjectDefinitionStartStopMethodsInspector.hasStopMethod(objectDefinition));
  }

  /**
   * @param {SingletonDefinition} objectDefinition singleton definition
   */
  doInspect(objectDefinition) {
    if (ObjectDefinitionStartStopMethodsInspector.hasStartMethod(objectDefinition)) {
      objectDefinition.startFunction(ObjectDefinitionStartStopMethodsInspector.getStartMethod(objectDefinition))
    }
    if (ObjectDefinitionStartStopMethodsInspector.hasStopMethod(objectDefinition)) {
      objectDefinition.stopFunction(ObjectDefinitionStartStopMethodsInspector.getStopMethod(objectDefinition))
    }
  }
}
