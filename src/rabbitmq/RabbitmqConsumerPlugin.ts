import BaseApp from '../app/BaseApp';
import { Plugin } from '../app/BaseApp';
import { BaseSingletonDefinition } from '../ioc/objectdefinition/BaseSingletonDefinition';
import { RabbitmqConsumer } from './RabbitmqConsumer';

export default class RabbitmqConsumerPlugin implements Plugin {
  name = 'RabbitmqConsumerPlugin';

  getName() {
    return this.name;
  }

  willStart(app: BaseApp) {
    if (!app.hasConfig('rabbitmq')) {
      throw new Error('RabbitmqPlugin has been registered but could not find config using key "rabbitmq"');
    }

    const context = app.getContext();
    const clientConf = context.getConfig('rabbitmq.client');
    const confs = context.getConfig('rabbitmq.consumer');
    Object.keys(confs).forEach((key) => {
      const clientType = 'consumer';
      const name = `${key}.${clientType}`;
      const consumerSingleton = new BaseSingletonDefinition<any>(RabbitmqConsumer, name);
      consumerSingleton.constructorParamByValue(clientConf);
      consumerSingleton.constructorParamByValue(name);
      consumerSingleton.constructorParamByValue(confs[key]);
      consumerSingleton.constructorParamByRef(confs[key]['messageHandler']);
      context.registerSingletons(consumerSingleton);
    });
  }
}
