import { Channel, Message, Replies, Options } from 'amqplib';
import { NewrelicUtil } from '../newrelic/NewrelicUtil';
import { RabbitmqClient } from './RabbitmqClient';
import { RabbitmqConsumerConfig, RabbitmqClientConfig } from './RabbitmqConfig';
import { RabbitmqConsumerHandler } from './RabbitmqConsumerHandler';
import { RabbitmqConsumerHandlerUnrecoverableError } from './RabbitmqConsumerHandlerError';

const newrelic = NewrelicUtil.getNewrelicIfAvailable();

class NewrelichandlerWrapper extends RabbitmqConsumerHandler {
  constructor(protected baseHandler: RabbitmqConsumerHandler) {
    super();
  }
  async handle(message: Message): Promise<void> {
    newrelic.startBackgroundTransaction(this.baseHandler.constructor.name, 'RabbitMQConsumer', async () => {
      const transaction = newrelic.getTransaction();
      try {
        await this.baseHandler.handle(message);
      } finally {
        transaction.end();
      }
    });
  }
}


export class RabbitmqConsumer extends RabbitmqClient {
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
  }

  async init(): Promise<void> {
    await super.init();
    await this.subscribe(this.consumerConfig.appQueueName, this.consumerConfig.options);
  }

  /**
   * Subscribe to a queue
   */
  async subscribe(queueName: string, consumeOptions: Options.Consume = {}): Promise<Replies.Consume> {
    return await this.channel.consume(
      queueName,
      (message: Message) => {
          this.handleMessage(message);
      },
      consumeOptions);
  }

  async handleMessage(message: Message) {
    try {
      await this.messageHandler.handle(message);
    } catch (e) {
      const retriesCount = ++message.properties.headers.retriesCount;
      if (e instanceof RabbitmqConsumerHandlerUnrecoverableError || !this.allowRetry(retriesCount)) {
        // add to dlq
        try {
          this.channel.sendToQueue(this.consumerConfig.dlqName, message.content);
        } catch (err) {
          this.logger.error('failed to send message to dlq', err);
          this.channel.nack(message);
        }
      } else {
        // depending on retries config, retry
        const ttl = this.getTtl(retriesCount);
        const options: Options.Publish = {
          expiration: ttl,
          headers: message.properties.headers,
        };

        try {
          this.channel.sendToQueue(this.consumerConfig.delayQueueName, message.content, options);
        } catch (err) {
          // put message back to rabbitmq
          this.channel.nack(message);
        }
      }
    } finally {
      this.channel.ack(message);
    }
  }

  /**
   *
   * @param retriesCount number
   * @reutrn number in milliseconds
   */
  getTtl(retriesCount = 1): number {
    if (this.allowRetry(retriesCount)) {
      return Math.pow(this.consumerConfig.retryDelayFactor, retriesCount - 1)
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
