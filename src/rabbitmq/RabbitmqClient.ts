import { connect, Connection, Channel, Options } from 'amqplib';
import { Logger } from '../log/LogManager';
import { RabbitmqProducerConfig, RabbitmqClientConfig } from './RabbitmqConfig';

export interface PublishOptions {
  expiration?: string | number,
  userId?: string,
  CC?: string | string[],

  mandatory?: boolean,
  persistent?: boolean,
  deliveryMode?: boolean | number,
  BCC?: string | string[],

  contentType?: string,
  contentEncoding?: string,
  headers?: any,
  priority?: number,
  correlationId?: string,
  replyTo?: string,
  messageId?: string,
  timestamp?: number,
  type?: string,
  appId?: string,
}
export interface ConsumeOptions {
  consumerTag?: string,
  noLocal?: boolean,
  noAck?: boolean,
  exclusive?: boolean,
  priority?: number,
  arguments?: any,
}

export interface RepliesConsume {
  consumerTag: string,
}

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

  async close(): Promise<void> {
    await this.closeChannel();
    await this.closeConnection();
  }

  async closeChannel(): Promise<void> {
    this.channel.close();
  }

  async closeConnection(): Promise<void> {
    this.connection.close();
  }

  // prefetch
}
