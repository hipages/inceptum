import { Channel } from 'amqplib';
import * as stringify from 'json-stringify-safe';
import { Counter, Histogram } from 'prom-client';
import { NewrelicUtil } from '../newrelic/NewrelicUtil';
import { LogManager } from '../log/LogManager';
import { RabbitmqClient } from './RabbitmqClient';
import { RabbitmqConsumerConfig, RabbitmqClientConfig } from './RabbitmqConfig';
import { PublishOptions, ConsumeOptions, RepliesConsume } from './RabbitmqClient';
import { RabbitmqConsumerHandler, Message } from './RabbitmqConsumerHandler';
import { RabbitmqConsumerHandlerUnrecoverableError, MessageInfo, RabbitmqConsumerHandlerError } from './RabbitmqConsumerHandlerError';

const logger = LogManager.getLogger(__filename);

const newrelic = NewrelicUtil.getNewrelicIfAvailable();

class NewrelichandlerWrapper extends RabbitmqConsumerHandler {
  constructor(protected baseHandler: RabbitmqConsumerHandler) {
    super();
  }
  async handle(message: Message): Promise<void> {
    await newrelic.startBackgroundTransaction(this.baseHandler.constructor.name, 'RabbitMQConsumer', async () => {
      const transaction = newrelic.getTransaction();
      try {
        await this.baseHandler.handle(message);
      } finally {
        transaction.end();
      }
    });
  }
}

const rabbitmqConsumeTime = new Histogram({
  name: 'rabbitmq_consume_time',
  help: 'Time required to consumer a messages from RabbitMQ',
  labelNames: ['name'],
  buckets: [0.003, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5]});
const rabbitmqConsumeErrorCounter = new Counter({
  name: 'rabbitmq_consume_error_counter',
  help: 'Number of errors encountered when consuming messages',
  labelNames: ['name'],
});
const rabbitmqConsumeDLQCounter = new Counter({
  name: 'rabbitmq_consume_to_dlq_counter',
  help: 'Number of messages sent to the DLQ',
  labelNames: ['name'],
});
const rabbitmqConsumeDelayedCounter = new Counter({
  name: 'rabbitmq_consume_delayed_counter',
  help: 'Number of messages sent to the delay queue',
  labelNames: ['name'],
});

export class RabbitmqConsumer extends RabbitmqClient {
  consumeFailuresDelayed: Counter.Internal;
  consumeFailuresDLQ: Counter.Internal;
  consumeFailures: Counter.Internal;
  consumeDurationHistogram: Histogram.Internal;
  protected consumerConfig: RabbitmqConsumerConfig;
  protected messageHandler: RabbitmqConsumerHandler;

  constructor(
    clientConfig: RabbitmqClientConfig,
    name: string,
    consumerConfig,
    handler: RabbitmqConsumerHandler) {
      super(clientConfig, name);
      this.messageHandler = newrelic ? new NewrelichandlerWrapper(handler) : handler;
      this.consumerConfig = {...consumerConfig};
      this.consumerConfig.options = this.consumerConfig.options || {};
      this.logger = logger;
      this.consumeDurationHistogram = rabbitmqConsumeTime.labels(name);
      this.consumeFailures = rabbitmqConsumeErrorCounter.labels(name);
      this.consumeFailuresDLQ = rabbitmqConsumeDLQCounter.labels(name);
      this.consumeFailuresDelayed = rabbitmqConsumeDelayedCounter.labels(name);

  }

  async init(): Promise<void> {
    try {
      await super.init();
      await this.subscribe(this.consumerConfig.appQueueName, this.consumerConfig.options);
    } catch (e) {
      const c = { ...this.consumerConfig };
      this.logger.error(e, `failed to subscribe with config - ${c.toString()}`);
      NewrelicUtil.noticeError(e, {config: c});
      throw e;
    }
  }

  /**
   * Subscribe to a queue
   */
  async subscribe(queueName: string, consumeOptions: ConsumeOptions = {}): Promise<RepliesConsume> {
    if (consumeOptions.prefetch && consumeOptions.prefetch > 0) {
      this.channel.prefetch(consumeOptions.prefetch);
    }
    return await this.channel.consume(
      queueName,
      (message: Message) => {
          this.handleMessage(message);
      },
      consumeOptions);
  }

  async handleMessage(message: Message) {
    const timer = this.consumeDurationHistogram.startTimer();
    try {
      await this.messageHandler.handle(message);
      this.channel.ack(message);
    } catch (e) {
      this.logger.error(e, 'failed to handle message');
      this.consumeFailures.inc();
      NewrelicUtil.noticeError(e, message);
      const retriesCount = ++message.properties.headers.retriesCount;
      if (e instanceof RabbitmqConsumerHandlerUnrecoverableError || !this.allowRetry(retriesCount)) {
        // add to dlq
        this.consumeFailuresDLQ.inc();
        try {
          this.sendMessageToDlq(message);
          this.channel.ack(message);
        } catch (err) {
          this.logger.error(err, 'failed to send message to dlq');
          NewrelicUtil.noticeError(err, message);
          this.channel.nack(message);
        }
      } else {
        this.consumeFailuresDelayed.inc();
        try {
          this.sendMessageToDelayedQueue(message, retriesCount, e);
          this.channel.ack(message);
        } catch (error) {
          // put message back to rabbitmq
          this.logger.error(error, 'failed to send message to delayed queue');
          NewrelicUtil.noticeError(error, message);
          this.channel.nack(message);
        }
      }
    } finally {
      timer();
    }
  }

  sendMessageToDlq(message: Message) {
    this.channel.sendToQueue(this.consumerConfig.dlqName, message.content);
    this.logger.info(this.stringyifyMessageContent(message), 'sent message to dlq');
  }

  sendMessageToDelayedQueue(message: Message, retriesCount: number, e: Error) {
    const ct = this.stringyifyMessageContent(message);
    // depending on retries config, retry
    const ttl = this.getTtl(retriesCount);
    const options: PublishOptions = {
      expiration: ttl,
      headers: message.properties.headers,
    };
    this.channel.sendToQueue(this.consumerConfig.delayQueueName, message.content, options);
    const data: MessageInfo = {
      queueName: this.consumerConfig.delayQueueName,
      messageContent: ct,
      options,
    };

    this.logger.info(data, `sent message to delayed queue`);
  }

  stringyifyMessageContent(message: Message): string {
    return message.content.toString();
  }

  /**
   *
   * @param retriesCount number
   * @reutrn number in milliseconds
   */
  getTtl(retriesCount = 1): number {
    if (this.allowRetry(retriesCount)) {
      return Math.pow(retriesCount, this.consumerConfig.retryDelayFactor)
        * this.consumerConfig.retryDelayInMinute * 60 * 1000;
    }

    return 0;
  }

  allowRetry(retriesCount: number): boolean {
    return retriesCount && this.consumerConfig.maxRetries >= retriesCount;
  }

  async close(): Promise<void> {
      await super.close();
  }

}
