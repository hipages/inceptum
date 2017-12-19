import { connect, Connection, Channel } from 'amqplib';
import { Logger } from '../../src/log/LogManager';
import { RabbitmqProducerConfig, RabbitmqClientConfig } from './RabbitmqConfig';

export abstract class RabbitmqClient {
  protected channel: Channel;
  protected connection: Connection;
  protected logger: Logger;
  protected clientConfig: RabbitmqClientConfig;
  protected name: string;

  constructor(clientConfig: RabbitmqClientConfig, name: string) {
    clientConfig.protocol = clientConfig.protocol || 'amqp';
    this.clientConfig = clientConfig;
    this.name = name;
  }

  async init() {
    await this.connect();
    await this.createChannel();
  }

  /**
   * Connect to RabbitMQ broker
   */
  protected async connect(): Promise<void> {
    this.connection = await connect(this.clientConfig);
  }

  protected async createChannel(): Promise<void> {
    this.channel = await this.connection.createChannel();
  }

  async closeChannel(): Promise<void> {
    await this.channel.close();
  }

  async closeConnection(): Promise<void> {
    await this.connection.close();
  }

  // prefetch
}
