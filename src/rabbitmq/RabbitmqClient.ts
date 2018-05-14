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

export enum ReconnectionStatus {
  NotInitialised,
  InProgress,
  Failed,
}

export abstract class RabbitmqClient {
  protected channel: Channel;
  protected connection: Connection;
  protected logger: Logger;
  protected clientConfig: RabbitmqClientConfig;
  protected name: string;
  protected closed = false;
  protected reconnectionStatus: ReconnectionStatus;
  protected reconnectionTimer: NodeJS.Timer;
  protected channelReadyPromise: Promise<void>;
  protected channelReadyPromiseResolve: () => void;
  protected shutdownFunction: () => void;

  constructor(clientConfig: RabbitmqClientConfig, name: string) {
    clientConfig.protocol = clientConfig.protocol || 'amqp';
    this.clientConfig = clientConfig;
    this.name = name;
    this.reconnectionStatus = ReconnectionStatus.NotInitialised;
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
    const newConnection = await connect(this.clientConfig);
    newConnection.on('close', () => { this.handleConnectionClosed(); });
    newConnection.on('error', (err) => { this.handleConnectionError(err); });
    this.connection = newConnection;
    this.logger.info('Connection established');
    await this.createChannel();
  }

  protected handleConnectionClosed() {
    this.logger.error('Connection closed unexpectedly');
    this.initialiseReconnection();
  }

  protected handleConnectionError(err?) {
    if (err) {
      this.logger.error(err, 'Connection error');
      this.initialiseReconnection();
    } else {
      this.logger.error('Connection error. Ignoring');
    }
  }

  protected async createChannel(): Promise<void> {
    const newChannel = await this.connection.createChannel();
    newChannel.on('close', (err?) => { this.handleChannelClosed(err); });
    newChannel.on('error', (err) => { this.handleChannelError(err); });
    this.channel = newChannel;
    this.logger.info('Channel opened');
    this.channelReady();
  }

  protected handleChannelClosed() {
    this.logger.error('Channel closed unexpectedly');
    this.initialiseReconnection();
  }

  protected handleChannelError(err?) {
    if (err) {
      this.logger.error(err, 'Channel error');
      this.initialiseReconnection();
    } else {
      this.logger.error('Channel error. Ignoring');
    }
  }

  protected async initialiseReconnection() {
    if (this.reconnectionStatus === ReconnectionStatus.NotInitialised) {
      this.logger.warn('Initialising reconnection...');
      this.reconnectionStatus = ReconnectionStatus.InProgress;

      if (this.channel) {
        this.logger.warn('Closing channel');
        this.channel.removeAllListeners();
        try {
          await this.channel.close();
        } catch (e) {
          // Do nothing... we tried to play nice
        }
      }

      if (this.connection) {
        this.logger.warn('Closing connection');
        this.connection.removeAllListeners();
        try {
          await this.connection.close();
        } catch (e) {
          // Do nothing... we tried to play nice
        }
      }

      this.closed = true;
      this.scheduleReconnectionAttempts();
    }
  }

  public scheduleReconnectionAttempts() {
    this.reconnectionTimer = setTimeout(() => this.attemptReconnection(), 0);
  }

  public async attemptReconnection() {
    this.clearReconnectionTimer();

    let attempts = 0;
    while (attempts < this.getMaxConnectionAttempts()) {
      try {
        attempts++;
        await this.connect();
        this.reconnectionStatus = ReconnectionStatus.NotInitialised;
        return;
      } catch (e) {
        this.logger.warn(e, 'Failed reconnection attempt');
      }
    }

    this.reconnectionStatus = ReconnectionStatus.Failed;
    this.logger.error(`Couldn't reconnect after ${this.getMaxConnectionAttempts()} attempts`);

    // tslint:disable-next-line
    if (this.clientConfig.exitOnIrrecoverableReconnect !== false) {
      this.logger.error('Cowardly refusing to continue. Calling shutdown function');
      this.shutdownFunction();
    }
  }

  public clearReconnectionTimer() {
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = undefined;
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
