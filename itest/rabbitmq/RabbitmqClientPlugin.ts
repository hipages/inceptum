import { suite, test } from 'mocha-typescript';
import { must } from 'must';
import BaseApp from '../../src/app/BaseApp';
import { RabbitmqClientConfig, RabbitmqConsumerConfig, RabbitmqBackPressureStrategy } from '../../src/rabbitmq/RabbitmqConfig';
import { RabbitmqProducerConfig } from '../../src/rabbitmq/RabbitmqConfig';
import { BaseSingletonDefinition } from '../../src/ioc/objectdefinition/BaseSingletonDefinition';
import { JsonProvider } from '../../src/config/JsonProvider';
import RabbitmqClientPlugin from '../../src/rabbitmq/RabbitmqClientPlugin';
import { RabbitmqConsumerHandler } from '../../src/rabbitmq/RabbitmqConsumerHandler';

const rabbitClientConfig: RabbitmqClientConfig = {
  hostname: 'localhost',
  port: 5672,
  username: 'hip',
  password: 'hipages',
  maxConnectionAttempts: 3,
  protocol: 'amqp',
  mgtHttpPort: 15672,
  mgtHttpHost: 'localhost',
  mgtHttpTheme: 'http',
};

const rabbitConsumerConfig: RabbitmqConsumerConfig = {
  appQueueName: 'nuntius.mandrill.queue',
  delayQueueName: 'delay.queue',
  dlqName: 'dlq',
  messageHandler: 'DefaultHandler',
  maxRetries: 4,
  retryDelayInMinute: 0.01,
  retryDelayFactor: 2,
};

const rabbitmqProducerConfig: RabbitmqProducerConfig = {
  exchangeName: 'kk',
  backPressureStrategy: RabbitmqBackPressureStrategy.ERROR,
};

const configYml = {
  rabbitmq: {
    client: {},
    consumer: {},
    producer: {},
  },
};
configYml.rabbitmq.client = rabbitClientConfig;
configYml.rabbitmq.consumer = { peter: rabbitConsumerConfig };
configYml.rabbitmq.producer = { peter: rabbitmqProducerConfig };

class DefaultHandler extends RabbitmqConsumerHandler {
  async handle(): Promise<void> {
    console.log('');
  }
}

@suite
class RabbitmqClientPluginTest {

  @test
  async 'test consumer registered'() {
    const baseApp = new BaseApp({config: new JsonProvider(configYml)});
    baseApp.register(new RabbitmqClientPlugin());
    const context = baseApp.getContext();
    context.registerDefinition(new BaseSingletonDefinition<DefaultHandler>(DefaultHandler));
    await baseApp.start();
    const definition = context.getDefinitionByName('peter_consumer');
    definition.must.not.be.undefined();
    definition.getName().must.be.equal('peter_consumer');
    const consumer = await context.getObjectByName('peter_consumer');
    consumer.clientConfig.must.be.eql(rabbitClientConfig);
    rabbitConsumerConfig.options = {};
    consumer.consumerConfig.must.be.eql(rabbitConsumerConfig);

    const producerDef = baseApp.getContext().getDefinitionByName('peter_producer');
    producerDef.must.not.be.undefined();
    producerDef.getName().must.be.equal('peter_producer');
    const producerObj = await baseApp.getContext().getObjectByName('peter_producer');
    producerObj.clientConfig.must.be.eql(rabbitClientConfig);
    producerObj.producerConfig.must.be.eql(rabbitmqProducerConfig);

    const HC = baseApp.getContext().getDefinitionByName('HC_rabbitmq');
    HC.must.not.be.undefined();
    await baseApp.stop();
  }

}
