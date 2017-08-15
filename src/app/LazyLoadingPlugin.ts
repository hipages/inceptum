// tslint:disable:prefer-function-over-method
import { ObjectDefinitionLazyLoadingInspector } from '../ioc/autoconfig/ObjectDefinitionLazyLoadingInspector';
import { Plugin } from './BaseApp';

export default class LazyLoadingPlugin implements Plugin {
  name = 'LazyLoadingPlugin';
  willStart(app) {
    app.getContext().addObjectDefinitionInspector(new ObjectDefinitionLazyLoadingInspector());
  }
}
