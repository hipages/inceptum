import { must } from 'must';
import { suite, test, timeout } from 'mocha-typescript';
import { Channel, Message, Replies, Options } from 'amqplib';
// import * as mustSinon from 'must-sinon';
import * as sinon from 'sinon';
import { error } from 'util';
import { LogManager, Logger } from '../../src/log/LogManager';
import { RabbitmqProducer } from '../../src/rabbitmq/RabbitmqProducer';
import { RabbitmqConsumer } from '../../src/rabbitmq/RabbitmqConsumer';
import { RabbitmqProducerConfig, BackPressureStrategy, RabbitmqConsumerConfig, RabbitmqClientConfig } from '../../src/rabbitmq/RabbitmqConfig';
import { RabbitmqConsumerHandler } from '../../src/rabbitmq/RabbitmqConsumerHandler';
import { RabbitmqConsumerHandlerUnrecoverableError, RabbitmqConsumerHandlerError } from '../../src/rabbitmq/RabbitmqConsumerHandlerError';

const logger = LogManager.getLogger();
const clientConfig: RabbitmqClientConfig = {
    protocol: '',
    hostname: 'localhost',
    port: 5672,
    username: 'hip',
    password: 'hipages',
};
const producerConfig: RabbitmqProducerConfig = {
    exchangeName: 'firehose',
    backPressureStrategy: BackPressureStrategy.ERROR,
};

const routingKeyAppName = 'nuntius.channelNotificationCreated';
const channelName = 'mandrill';
const emailConsumerConfig: RabbitmqConsumerConfig = {
    appQueueName: 'nuntius.mandrill.queue',
    delayQueueName: 'nuntius.mandrill.delay.queue',
    dlqName: 'nuntius.mandrill.dlq',
    maxRetries: 4,
    retryDelayInMinute: 2,
    retryDelayFactor: 5,
    options: {},
};

const smsConsumerConfig = { ...emailConsumerConfig };
smsConsumerConfig.options = { priority: 1 };

class RabbitmqConsumerHandlerTest extends RabbitmqConsumerHandler {
    protected logger: Logger = logger;
    // tslint:disable-next-line:prefer-function-over-method
    async handle(msg: Message) {
        // tslint:disable-next-line:no-console
        const { fields, properties, content} = msg;
    }
}

class RabbitmqConsumerHandlerTestUnrecoverableException extends RabbitmqConsumerHandler {
    protected logger: Logger = logger;
    // tslint:disable-next-line:prefer-function-over-method
    async handle(msg: Message) {
        // tslint:disable-next-line:no-console
        const { fields, properties, content} = msg;
        throw new RabbitmqConsumerHandlerUnrecoverableError();
    }
}

class RabbitmqConsumerHandlerTestException extends RabbitmqConsumerHandler {
    protected logger: Logger = logger;
    // tslint:disable-next-line:prefer-function-over-method
    async handle(msg: Message) {
        // tslint:disable-next-line:no-console
        const { fields, properties, content} = msg;
        if (msg.properties.headers.retriesCount < 2) {
            throw new RabbitmqConsumerHandlerError();
        }
    }
}

class RabbitmqProducerExposedChannel extends RabbitmqProducer {
    setChannel(channel) {
        this.channel = channel;
    }

    getChannel() {
        return this.channel;
    }
}

@suite
class RabbitmqProducerAndConsumerTest {

    protected producer: RabbitmqProducer;

    async before() {
        this.producer = new RabbitmqProducer(clientConfig, 'nuntius', producerConfig);
        await this.producer.init();
    }

    @test
    // tslint:disable-next-line:prefer-function-over-method
    async 'test one producer and one consumer'() {
        const handler = new RabbitmqConsumerHandlerTest();
        const handlerSpy = sinon.spy(handler, 'handle');
        const routingKey = `${routingKeyAppName}.kkk-123-dsad.${channelName}`;
        await this.publishMessage(routingKey);

        const appQueueConsumer = new RabbitmqConsumer(clientConfig, 'mandrill', emailConsumerConfig, handler);
        await appQueueConsumer.init();

        handlerSpy.called.must.be.true();
    }

    @test
    // tslint:disable-next-line:prefer-function-over-method
    async 'test unrecoverable error'() {
        // error consumer subscribe app queue
        const handlerExceptionCreator = new RabbitmqConsumerHandlerTestUnrecoverableException();
        const handlerExceptionSpy = sinon.spy(handlerExceptionCreator, 'handle');
        const appQueueConsumer = new RabbitmqConsumer(
            clientConfig,
            'mandrill',
            smsConsumerConfig,
            handlerExceptionCreator);
        await appQueueConsumer.init();

        // publish msg
        const routingKey = `${routingKeyAppName}.uweqw-212-d-sfcx-dssa.${channelName}`;
        await this.publishMessage(routingKey);

        // create dlq consumer
        const dlqConsumerConfig = { ...smsConsumerConfig };
        dlqConsumerConfig.appQueueName = smsConsumerConfig.dlqName;
        const dlqHandler = new RabbitmqConsumerHandlerTest();
        const dlqHandlerSpy = sinon.spy(dlqHandler, 'handle');
        const dlqConsumer = new RabbitmqConsumer(
            clientConfig,
            'mandrill',
            dlqConsumerConfig,
            dlqHandler,
        );
        // subscribe
        await dlqConsumer.init();

        // make sure there is an exception
        handlerExceptionSpy.called.must.be.true();
        // dlq consumer handler should be called.
        dlqHandlerSpy.called.must.be.true();
    }

    @test
    async 'test message in delay message'() {
        // create consumer using priority
        const handler = new RabbitmqConsumerHandlerTestException();
        const handlerSpy = sinon.spy(handler, 'handle');
        const errorConfig = {...emailConsumerConfig};
        errorConfig.maxRetries = 4;
        errorConfig.retryDelayInMinute = 0.005;
        errorConfig.retryDelayFactor = 1;
        errorConfig.options = { priority: 3 };
        const errorConsumer = new RabbitmqConsumer(clientConfig, 'nuntius', errorConfig, handler);
        await errorConsumer.init();

        // publish message
        const routingKey = `${routingKeyAppName}.ll-opp-222.${channelName}`;
        await this.publishMessage(routingKey);

        await new Promise((resolve, reject) => setTimeout(resolve, 1000));
        handlerSpy.calledThrice.must.be.true();
    }

    @test
    'test get time to live'() {
        const consumer = new RabbitmqConsumer(
            clientConfig,
            'test',
            emailConsumerConfig,
            new RabbitmqConsumerHandlerTest());

        const firstRetryTime = consumer.getTtl();
        firstRetryTime.must.equal(120000);

        const secondRetryTime = consumer.getTtl(2);
        secondRetryTime.must.equal(600000);

        const thirdRetryTime = consumer.getTtl(3);
        thirdRetryTime.must.equal(3000000);

        const fourthRetryTime = consumer.getTtl(4);
        fourthRetryTime.must.equal(250 * 60 * 1000);

        const fifthRetryTime = consumer.getTtl(5);
        fifthRetryTime.must.equal(0);

        const zeroRetryTime = consumer.getTtl(0);
        zeroRetryTime.must.equal(0);
    }

    @test
    async 'error is occured when publishing message'() {
        const producer = new RabbitmqProducerExposedChannel(clientConfig, 'error', producerConfig);
        await producer.init();
        const channelStub = sinon.stub(producer.getChannel(), 'publish').returns(false);
        producer.setChannel(channelStub);
        producer.publish('test msg', 'a-key').must.reject.with.error();
    }

    /**
     *
     * @param routingKey string
     */
    // tslint:disable-next-line:prefer-function-over-method
    protected async publishMessage(routingKey: string) {
        // const producer = new RabbitmqProducer(producerConfig);
        // await producer.init();
        const t = new Date();
        try {
            this.producer.publish(
                `test message: ${t.getMinutes()}.${t.getSeconds()}.${t.getMilliseconds()}`,
                routingKey,
            );
        } catch (e) {
            console.log(e.message);
        }
    }
}

