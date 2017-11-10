import { BaseSingletonDefinition } from '../ioc/objectdefinition/BaseSingletonDefinition';
import { AbstractObjectDefinitionInspector } from '../ioc/AbstractObjectDefinitionInspector';
import { SingletonDefinition } from '../ioc/objectdefinition/SingletonDefinition';
import { RouteRegisterUtil } from './WebPlugin';

export class WebRoutingInspector extends AbstractObjectDefinitionInspector {
  definition: BaseSingletonDefinition<RouteRegisterUtil>;
  routesToRegister = [];

  constructor(definition: BaseSingletonDefinition<RouteRegisterUtil>) {
    super();
    this.definition = definition;
    this.definition.setPropertyByValue('routesToRegister', this.routesToRegister);
  }

  // tslint:disable-next-line:prefer-function-over-method
  interestedIn(objectDefinition) {
    return (objectDefinition instanceof SingletonDefinition)
      && (objectDefinition.getProducedClass().routes !== undefined);
  }

  /**
   * @param {SingletonDefinition} objectDefinition singleton definition
   */
  // tslint:disable-next-line:prefer-function-over-method
  doInspect(objectDefinition: SingletonDefinition<any>) {
    const routes: Array<{verb?: string, path: string, methodName: string}> = objectDefinition.getProducedClass().routes;
    routes.forEach((route, index) => {
      const instanceName = `instance_${index}`;
      this.routesToRegister.push(
        {
          verb: route.verb || 'get',
          path: route.path,
          methodName: route.methodName,
          instanceProperty: instanceName,
          objectName: objectDefinition.getName(),
        });
      this.definition.setPropertyByRef(instanceName, objectDefinition.getName());
    });
  }
}
