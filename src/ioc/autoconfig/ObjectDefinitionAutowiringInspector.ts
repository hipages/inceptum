import { BaseSingletonDefinition } from '../objectdefinition/BaseSingletonDefinition';
import { ObjectDefinition } from '../objectdefinition/ObjectDefinition';
import { AbstractObjectDefinitionInspector } from '../AbstractObjectDefinitionInspector';
import { SingletonDefinition } from '../objectdefinition/SingletonDefinition';

interface Autowirable {
  autowire: AutowireInfo,
}
interface AutowireInfo {
  constructorArgs: string[],
}

export class ObjectDefinitionAutowiringInspector extends AbstractObjectDefinitionInspector {

  private static getAutowired(objectDefinition: BaseSingletonDefinition<any>): AutowireInfo {
    return objectDefinition.getProducedClass().hasOwnProperty('autowire') ?
      (objectDefinition.getProducedClass()).autowire : undefined;
  }

  // tslint:disable-next-line:prefer-function-over-method
  interestedIn(objectDefinition: ObjectDefinition<any>) {
    if (!(objectDefinition instanceof BaseSingletonDefinition)) {
      return false;
    }
    return ObjectDefinitionAutowiringInspector.getAutowired(objectDefinition) !== undefined;
  }

  /**
   * @param {BaseSingletonDefinition} objectDefinition singleton definition
   */
  // tslint:disable-next-line:prefer-function-over-method
  doInspect(objectDefinition: BaseSingletonDefinition<any>) {
    const autowire = ObjectDefinitionAutowiringInspector.getAutowired(objectDefinition);
    if (autowire.constructorArgs) {
      autowire.constructorArgs.forEach((val) => {
        switch (val.substr(0, 1)) {
          case '~':
            objectDefinition.constructorParamByType(val.substr(1));
            break;
          case '*':
            objectDefinition.constructorParamByTypeArray(val.substr(1));
            break;
          case '#':
            objectDefinition.constructorParamByConfig(val.substr(1));
            break;
          default:
            // By Name
            objectDefinition.constructorParamByRef(val);
        }
      });
    }
    Object.keys(autowire).filter((key) => key !== 'constructorArgs').forEach((key) => {
      const val = autowire[key];
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
        default:
          // By Name
          objectDefinition.setPropertyByRef(key, val);
      }
    });
  }
}
