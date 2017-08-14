// tslint:disable:prefer-function-over-method
import { ObjectDefinitionStartStopMethodsInspector } from '../ioc/autoconfig/ObjectDefinitionStartStopMethodsInspector';
import {Plugin} from './BaseApp';

export default class StartStopPlugin implements Plugin {
  name = 'StartStopPlugin';

  willStart(app) {
    app.getContext().addObjectDefinitionInspector(new ObjectDefinitionStartStopMethodsInspector());
  }
}
