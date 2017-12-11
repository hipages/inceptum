// tslint:disable:prefer-function-over-method
import { ObjectDefinitionDecoratorInspector } from '../../ioc/autoconfig/ObjectDefinitionDecoratorInspector';
import BaseApp, { Plugin } from '../BaseApp';

export default class DecoratorPlugin implements Plugin {
  name = 'DecoratorPlugin';
  willStart(app: BaseApp) {
    app.getContext().addObjectDefinitionInspector(new ObjectDefinitionDecoratorInspector());
  }
}
