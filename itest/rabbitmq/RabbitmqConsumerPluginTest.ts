import { must } from 'must';
import { suite, test } from 'mocha-typescript';
import { RabbitmqClientConfig, RabbitmqConsumerConfig } from '../../src/rabbitmq/RabbitmqConfig';
import { InceptumApp, BaseSingletonDefinition } from '../../src/index';
import JsonProvider from '../../src/config/JsonProvider';
import { RabbitmqConsumerHandler } from '../../src/rabbitmq/RabbitmqConsumerHandler';

const rabbitClientConfig: RabbitmqClientConfig = {
  hostname: 'localhost',
  port: 5672,
  username: 'hip',
  password: 'hipages',
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

const configYml = {
  rabbitmq: {
    client: {},
    consumer: {},
    producer: {},
  },
};
configYml.rabbitmq.client = rabbitClientConfig;
configYml.rabbitmq.consumer = { peter: rabbitConsumerConfig };

class DefaultHandler extends RabbitmqConsumerHandler {
  async handle(): Promise<void> {
    console.log('');
  }
}

@suite
class RabbitmqConsumerPluginTest {

  @test
  async 'RabbitmqConsumerPlugin should be registered'() {
    const app = new InceptumApp({config: new JsonProvider(configYml)});
    app.getContext().registerDefinition(new BaseSingletonDefinition<DefaultHandler>(DefaultHandler));
    await app.start();
    const definition = app.getContext().getDefinitionByName('peter_consumer');
    definition.must.not.be.undefined();
    definition.getName().must.be.equal('peter_consumer');
    const consumer = await app.getContext().getObjectByName('peter_consumer');
    consumer.clientConfig.must.be.eql(rabbitClientConfig);
    rabbitConsumerConfig.options = {};
    consumer.consumerConfig.must.be.eql(rabbitConsumerConfig);
  }
}
