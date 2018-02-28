import { BaseSingletonDefinition, RabbitmqBackPressureStrategy } from '../index';
import BaseApp, { Plugin } from '../app/BaseApp';
import { RabbitmqProducer } from './RabbitmqProducer';
import { RabbitmqConsumer } from './RabbitmqConsumer';
import { RabbitmqMgtHttpApi } from './RabbitmqMgtHttpApi';
import { RabbitmqHealthCheck } from './RabbitmqHealthCheck';

export default class RabbitmqClientPlugin implements Plugin {
  name = 'RabbitmqClientPlugin';

  getName() {
    return this.name;
  }

  willStart(app: BaseApp) {
    if (!app.hasConfig('rabbitmq')) {
      throw new Error('RabbitmqPlugin has been registered but could not find config using key "rabbitmq"');
    }

    const context = app.getContext();
    const clientConf = context.getConfig('rabbitmq.client');

    // register health check
    const mgtAPI = new BaseSingletonDefinition<RabbitmqMgtHttpApi>(RabbitmqMgtHttpApi);
    context.registerSingletons(mgtAPI);

    const rhc = new BaseSingletonDefinition<RabbitmqHealthCheck>(RabbitmqHealthCheck, 'HC_rabbitmq');
    rhc.constructorParamByValue('rabbitmq');
    context.registerDefinition(rhc);

    if (context.hasConfig('rabbitmq.producer')) {
      const producerConfs = context.getConfig('rabbitmq.producer');
      Object.keys(producerConfs).forEach((key) => {
        const TypeConsumer = 'producer';
        const name = `${key}_${TypeConsumer}`;
        const clientSingleton = new BaseSingletonDefinition<RabbitmqProducer>(RabbitmqProducer, name);
        clientSingleton.constructorParamByValue(clientConf);
        clientSingleton.constructorParamByValue(name);
        clientSingleton.constructorParamByValue(producerConfs[key]);
        clientSingleton.startFunction('init');
        clientSingleton.stopFunction('close');
        context.registerSingletons(clientSingleton);
      });
    }

    if (context.hasConfig('rabbitmq.consumer')) {
      const consumerConfs = context.getConfig('rabbitmq.consumer');
      Object.keys(consumerConfs).forEach((key) => {
        const clientTypeConsumer = 'consumer';
        const name = `${key}_${clientTypeConsumer}`;
        const consumerSingleton = new BaseSingletonDefinition<RabbitmqConsumer>(RabbitmqConsumer, name);
        consumerSingleton.constructorParamByValue(clientConf);
        consumerSingleton.constructorParamByValue(name);
        consumerSingleton.constructorParamByValue(consumerConfs[key]);
        consumerSingleton.constructorParamByRef(consumerConfs[key]['messageHandler']);
        consumerSingleton.startFunction('init');
        consumerSingleton.stopFunction('close');
        consumerSingleton.withLazyLoading(false);
        context.registerSingletons(consumerSingleton);
      });
    }
  }
}
