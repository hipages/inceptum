// tslint:disable:prefer-function-over-method
import { ObjectDefinitionAutowiringInspector } from '../../ioc/autoconfig/ObjectDefinitionAutowiringInspector';
import BaseApp, { Plugin } from '../BaseApp';

export default class AutowirePlugin implements Plugin {
  name = 'AutowirePlugin';
  willStart(app: BaseApp) {
    app.getContext().addObjectDefinitionInspector(new ObjectDefinitionAutowiringInspector());
  }
}
