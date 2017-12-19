import { must } from 'must';
import { suite, test } from 'mocha-typescript';
import { InceptumApp } from '../../src/index';
import JsonProvider from '../../src/config/JsonProvider';
import { RabbitmqClientConfig, RabbitmqProducerConfig, BackPressureStrategy } from '../../src/rabbitmq/RabbitmqConfig';

const rabbitClientConfig: RabbitmqClientConfig = {
  hostname: 'localhost',
  port: 1234,
  username: 'guest',
  password: 'guest',
};

const rabbitmqProducerConfig: RabbitmqProducerConfig = {
  exchangeName: 'kk',
  backPressureStrategy: BackPressureStrategy.ERROR,
};

const configYml = {
  rabbitmq: {
    client: {},
    consumer: {},
    producer: {},
  },
};
configYml.rabbitmq.client = rabbitClientConfig;
configYml.rabbitmq.producer = {peter: rabbitmqProducerConfig};

@suite
class RabbitmqProducerPluginTest {

  @test
  async 'RabbitmqProducerPlugin should be registered'() {
    const app = new InceptumApp({config: new JsonProvider(configYml)});
    await app.start();
    const definition = app.getContext().getDefinitionByName('peter.producer');
    definition.must.not.be.undefined();
    definition.getName().must.be.equal('peter.producer');
    const producer = await app.getContext().getObjectByName('peter.producer');
    producer.clientConfig.must.be.eql(rabbitClientConfig);
    producer.producerConfig.must.be.eql(rabbitmqProducerConfig);
  }
}
