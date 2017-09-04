// tslint:disable:prefer-function-over-method
import { BaseSingletonDefinition } from '../ioc/objectdefinition/BaseSingletonDefinition';
import BaseApp, { Plugin } from '../app/BaseApp';
import { SqsWorker } from './SqsWorker';

export default class SqsWorkerPlugin implements Plugin {
  name = 'SqsWorkerPlugin';

  getName() {
    return this.name;
  }

  willStart(app: BaseApp) {
    if (!app.hasConfig('SqsWorker')) {
      throw new Error('SQSWorkerPlugin has been registered but could not find config using key "SqsWorker"');
    }

    const context = app.getContext();
    const confs = context.getConfig('SqsWorker');
    Object.keys(confs).forEach((key) => {
      const clientSingleton = new BaseSingletonDefinition<any>(SqsWorker, key);
      clientSingleton.constructorParamByValue(confs[key]);
      clientSingleton.constructorParamByValue(key);
      clientSingleton.setPropertyByRef('handler', confs[key]['handlerObject']);
      context.registerSingletons(clientSingleton);
    });
  }
}
