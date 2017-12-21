import BaseApp, { Plugin } from '../app/BaseApp';
import { BaseSingletonDefinition } from '../ioc/objectdefinition/BaseSingletonDefinition';
import { RabbitmqProducer } from './RabbitmqProducer';

export default class RabbitmqProducerPlugin implements Plugin {
  name = 'RabbitmqProducerPlugin';

  getName() {
    return this.name;
  }

  willStart(app: BaseApp) {
    if (!app.hasConfig('rabbitmq')) {
      throw new Error('RabbitmqPlugin has been registered but could not find config using key "rabbitmq"');
    }

    const context = app.getContext();
    const confs = context.getConfig('rabbitmq.producer');
    const clientConf = context.getConfig('rabbitmq.client');
    Object.keys(confs).forEach((key) => {
      const clientType = 'producer';
      const name = `${key}_${clientType}`;
      const clientSingleton = new BaseSingletonDefinition<any>(RabbitmqProducer, name);
      clientSingleton.constructorParamByValue(clientConf);
      clientSingleton.constructorParamByValue(name);
      clientSingleton.constructorParamByValue(confs[key]);
      clientSingleton.startFunction('init');
      clientSingleton.stopFunction('close');
      context.registerSingletons(clientSingleton);
    });
  }
}
