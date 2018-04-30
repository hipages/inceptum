import { BaseSingletonDefinition } from '../ioc/objectdefinition/BaseSingletonDefinition';
import { AbstractObjectDefinitionInspector } from '../ioc/AbstractObjectDefinitionInspector';
import { SingletonDefinition } from '../ioc/objectdefinition/SingletonDefinition';
import { RouteRegisterUtil } from './WebPlugin';
import { hasWebDecoratorMetadata, getWebDecoratorMetadata, InceptumWebRouteMetadata } from './WebDecorators';

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
    if (!(objectDefinition instanceof BaseSingletonDefinition)) {
      return false;
    }
    return (objectDefinition.getProducedClass().routes !== undefined) ||
      hasWebDecoratorMetadata(objectDefinition.getProducedClass().prototype);
  }

  /**
   * @param {SingletonDefinition} objectDefinition singleton definition
   */
  // tslint:disable-next-line:prefer-function-over-method
  doInspect(objectDefinition: SingletonDefinition<any>) {
    if (objectDefinition.getProducedClass().routes) {
      // Old way
      this.processRoutes(objectDefinition.getProducedClass().routes || [], objectDefinition);
    }
    if (hasWebDecoratorMetadata(objectDefinition.getProducedClass().prototype)) {
      // New way
      this.processRoutes(getWebDecoratorMetadata(objectDefinition.getProducedClass().prototype).routes || [], objectDefinition);
    }
  }

  private processRoutes(routes: InceptumWebRouteMetadata[], objectDefinition) {
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
