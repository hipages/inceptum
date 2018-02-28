import { connect, Connection, Channel } from 'amqplib';
import { Logger } from '../log/LogManager';
import { RabbitmqProducerConfig, RabbitmqClientConfig, DEFAULT_MAX_CONNECTION_ATTEMPTS } from './RabbitmqConfig';

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
  protected closed = false;
  protected channelReadyPromise: Promise<void>;
  protected channelReadyPromiseResolve: () => void;
  protected shutdownFunction: () => void;

  constructor(clientConfig: RabbitmqClientConfig, name: string) {
    clientConfig.protocol = clientConfig.protocol || 'amqp';
    this.clientConfig = clientConfig;
    this.name = name;
    this.channelNotReady();
  }

  async init() {
    await this.connect();
  }

  protected async awaitChannelReady() {
    if (this.channelReadyPromise) {
      await this.channelReadyPromise;
    }
  }

  channelNotReady() {
    if (!this.channelReadyPromise) {
      this.channelReadyPromise = new Promise<void>((resolve) => {
        this.channelReadyPromiseResolve = resolve;
      });
    }
  }

  channelReady() {
    if (this.channelReadyPromise && this.channelReadyPromiseResolve) {
      this.channelReadyPromiseResolve();
      this.channelReadyPromise = undefined;
    }
  }

  private getMaxConnectionAttempts() {
    return this.clientConfig.maxConnectionAttempts || DEFAULT_MAX_CONNECTION_ATTEMPTS;
  }

  /**
   * Connect to RabbitMQ broker
   */
  protected async connect(): Promise<void> {
    if (this.connection) {
      this.connection.removeAllListeners();
      try {
        this.connection.close();
      } catch (e) {
        // Do nothing... we tried to play nice
      }
    }
    const newConnection = await connect(this.clientConfig);
    newConnection.on('close', () => { this.handleClientClosed(); });
    newConnection.on('error', (err) => { this.handleClientError(err); });
    this.connection = newConnection;
    await this.createChannel();
  }

  protected handleClientError(err?) {
    if (err) {
      this.logger.error(err, 'Client error. Ignoring');
    } else {
      this.logger.error(err, 'Client error. Ignoring');
    }
  }

  protected async handleClientClosed() {
    if (!this.closed) {
      // We haven't been explicitly closed, so we should reopen the channel
      this.logger.warn('Client was closed unexpectedly... reconnecting');
      let attempts = 0;
      while (attempts < this.getMaxConnectionAttempts()) {
        try {
          attempts++;
          await this.connect();
          return;
        } catch (e) {
          this.logger.error(e, 'Failed reconnection attempt');
        }
      }
      this.logger.error(`Couldn't reconnect after ${this.getMaxConnectionAttempts()} attempts`);
      if (this.clientConfig.exitOnIrrecoverableReconnect !== false) {
        this.logger.error(`Cowardly refusing to continue. Calling shutdown function`);
        this.shutdownFunction();
      }
    }
  }

  protected async createChannel(): Promise<void> {
    if (this.channel) {
      this.channel.removeAllListeners();
      try {
        this.channel.close();
      } catch (e) {
        // Do nothing... we tried to play nice
      }
    }
    const newChannel = await this.connection.createChannel();
    newChannel.on('close', (err?) => { this.handleChannelClosed(err); });
    newChannel.on('error', (err) => { this.handleChannelError(err); });

    this.channel = newChannel;
    this.channelReady();
  }

  protected async recreateClient() {
    let attempts = 0;
    while (attempts < this.getMaxConnectionAttempts()) {
      try {
        attempts++;
        await this.createChannel();
        return;
      } catch (e) {
        this.logger.error(e, 'Failed channel re-creation attempt');
      }
    }
    this.logger.error(`Couldn't re-create channel after ${this.getMaxConnectionAttempts()} attempts`);
    if (this.clientConfig.exitOnIrrecoverableReconnect !== false) {
      this.logger.error(`Cowardly refusing to continue. Calling shutdown function`);
      this.shutdownFunction();
    }
  }

  protected handleChannelError(err) {
    this.logger.error(err, 'Channel error, recreating channel');
    this.recreateClient();
  }

  protected handleChannelClosed(err?) {
    if (!this.closed) {
      // We haven't been explicitly closed, so we should reopen the channel
      this.logger.warn('Channel was closed unexpectedly... recreating');
      this.recreateClient();
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.closeChannel();
    await this.closeConnection();
  }

  async closeChannel(): Promise<void> {
    this.channel.close();
    this.channel.removeAllListeners();
  }

  async closeConnection(): Promise<void> {
    this.connection.close();
    this.connection.removeAllListeners();
  }

  // prefetch
}
