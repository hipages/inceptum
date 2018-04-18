import { connect, Connection, Channel } from 'amqplib';
import { isFatalError } from 'amqplib/lib/connection';
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
  connectionClosedTimer: NodeJS.Timer;
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
        await this.connection.close();
      } catch (e) {
        // Do nothing... we tried to play nice
      }
    }
    const newConnection = await connect(this.clientConfig);
    newConnection.on('close', () => { this.handleConnectionClosed(); });
    newConnection.on('error', (err) => { this.handleConnectionError(err); });
    this.connection = newConnection;
    this.logger.info('Connection established');
    await this.createChannel();
  }

  protected handleConnectionError(err?) {
    if (err) {
      this.logger.error(err, 'Connection error.');
      this.handleConnectionClosedDelayed();
    } else {
      this.logger.error('Connection error. Ignoring');
    }
  }

  private clearConnectionClosedTimer() {
    if (this.connectionClosedTimer) {
      clearTimeout(this.connectionClosedTimer);
      this.connectionClosedTimer = undefined;
    }
  }

  protected async handleConnectionClosedDelayed() {
    this.clearConnectionClosedTimer();
    try {
      this.connection.close();
    } catch (e) {
      this.logger.error(e, 'Got an error on the connection. Attempting to close just in case. Had an error');
    }
    this.connectionClosedTimer = setTimeout(() => this.handleChannelClosed(), 500);
  }

  protected async handleConnectionClosed() {
    this.clearConnectionClosedTimer();
    if (!this.closed) {
      // We haven't been explicitly closed, so we should reopen the channel
      this.logger.warn('Connection was closed unexpectedly... reconnecting');
      let attempts = 0;
      while (attempts < this.getMaxConnectionAttempts()) {
        try {
          attempts++;
          await this.connect();
          return;
        } catch (e) {
          this.logger.warn(e, 'Failed reconnection attempt');
        }
      }
      this.logger.error(`Couldn't reconnect after ${this.getMaxConnectionAttempts()} attempts`);
      // tslint:disable-next-line
      if (this.clientConfig.exitOnIrrecoverableReconnect !== false) {
        this.logger.error('Cowardly refusing to continue. Calling shutdown function');
        this.shutdownFunction();
      }
    }
  }

  protected async createChannel(): Promise<void> {
    if (this.channel) {
      this.channel.removeAllListeners();
      try {
        await this.channel.close();
      } catch (e) {
        // Do nothing... we tried to play nice
      }
    }
    const newChannel = await this.connection.createChannel();
    newChannel.on('close', (err?) => { this.handleChannelClosed(err); });
    newChannel.on('error', (err) => { this.handleChannelError(err); });
    this.channel = newChannel;
    this.logger.info('Channel opened');
    this.channelReady();
  }

  protected async recreateChannel() {
    let attempts = 0;
    while (attempts < this.getMaxConnectionAttempts()) {
      try {
        attempts++;
        await this.createChannel();
        return;
      } catch (e) {
        this.logger.warn(e, 'Failed channel re-creation attempt');
        if (isFatalError(e)) {
          this.logger.warn('Cannot recreate channel on closed connection');
          return;
        }
      }
    }
    this.logger.error(`Couldn't re-create channel after ${this.getMaxConnectionAttempts()} attempts`);
    // tslint:disable-next-line
    if (this.clientConfig.exitOnIrrecoverableReconnect !== false) {
      this.logger.error('Cowardly refusing to continue. Calling shutdown function');
      this.shutdownFunction();
    }
  }

  protected handleChannelError(err) {
    this.logger.error(err, 'Channel error, recreating channel');
    this.recreateChannel();
  }

  protected handleChannelClosed(err?) {
    if (!this.closed) {
      // We haven't been explicitly closed, so we should reopen the channel
      this.logger.warn('Channel was closed unexpectedly... recreating');
      this.recreateChannel();
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
}
