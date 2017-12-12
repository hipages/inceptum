import { BaseSingletonDefinition } from '../objectdefinition/BaseSingletonDefinition';
import { ObjectDefinition } from '../objectdefinition/ObjectDefinition';
import { AbstractObjectDefinitionInspector } from '../AbstractObjectDefinitionInspector';
import * as Decorator from '../Decorators';

export class ObjectDefinitionDecoratorInspector extends AbstractObjectDefinitionInspector {

  // tslint:disable-next-line:prefer-function-over-method
  interestedIn(objectDefinition: ObjectDefinition<any>) {
    if (!(objectDefinition instanceof BaseSingletonDefinition)) {
      return false;
    }
    return Decorator.hasDecoratorMetadata(objectDefinition.getProducedClass().prototype);
  }

  /**
   * @param {BaseSingletonDefinition} objectDefinition singleton definition
   */
  // tslint:disable-next-line:prefer-function-over-method
  doInspect(objectDefinition: BaseSingletonDefinition<any>) {
    const metadata = Decorator.getDecoratorMetadata(objectDefinition.getProducedClass().prototype);
    objectDefinition.withLazyLoading(metadata.lazy);
    if (metadata.startMethod) {
      objectDefinition.startFunction(metadata.startMethod);
    }
    if (metadata.stopMethod) {
      objectDefinition.stopFunction(metadata.stopMethod);
    }
    metadata.groups.forEach((groupName: string) => objectDefinition.getContext().addObjectNameToGroup(groupName, objectDefinition.getName()));
    metadata.autowire.forEach((val, key) => {
      switch (val.substr(0, 1)) {
        case '~':
          objectDefinition.setPropertyByType(key, val.substr(1));
          break;
        case '*':
          objectDefinition.setPropertyByTypeArray(key, val.substr(1));
          break;
        case '#':
          objectDefinition.setPropertyByConfig(key, val.substr(1));
          break;
        case '%':
          objectDefinition.setPropertyByGroup(key, val.substr(1));
          break;
        default:
          // By Name
          objectDefinition.setPropertyByRef(key, val);
      }
    });
  }
}
