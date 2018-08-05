import { connect, Connection, Channel } from 'amqplib';
import { isFatalError } from 'amqplib/lib/connection';
import { Logger } from '../log/LogManager';
import { ReadyGate } from '../util/ReadyGate';
import { RabbitmqProducerConfig, RabbitmqClientConfig, DEFAULT_MAX_CONNECTION_ATTEMPTS } from './RabbitmqConfig';

/*
Please read "RabbitMQ Connection Lifecycle.md" for an overview of how
connection and reconnection is managed for RabbitMQ
*/

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

  /**
   * Whether the connection should be closed. This is not a statud indicator that show whether the connection is closed.
   * It is a flag that indicates whether the client has been purposely closed by code, as opposed to being closed because of an error.
   */
  protected closed = false;
  protected reconnecting = false;
  protected reconnectionTimer: NodeJS.Timer;
  protected readyGate = new ReadyGate();
  protected shutdownFunction: () => void;
  protected connectFunction = connect;

  constructor(clientConfig: RabbitmqClientConfig, name: string) {
    this.clientConfig = { protocol: 'amqp', maxConnectionAttempts: DEFAULT_MAX_CONNECTION_ATTEMPTS, ...clientConfig };
    this.name = name;
    this.readyGate.channelNotReady();
  }

  async init() {
    await this.connect();
  }

  /**
   * Connect to RabbitMQ broker
   */
  protected async connect(): Promise<void> {
    await this.createConnection();
    await this.createChannel();
    this.reconnecting = false;
    this.readyGate.channelReady();
  }

  private async createConnection() {
    const newConnection = await this.connectFunction(this.clientConfig);
    newConnection.on('blocked', () => { this.handleErrorOrClose('Connection Blocked'); });
    newConnection.on('close', () => { this.handleErrorOrClose('Connection Closed'); });
    newConnection.on('error', (err) => { this.handleErrorOrClose('Connection Error', err); });
    this.connection = newConnection;
    this.logger.info('Connection established');
  }

  protected async createChannel(): Promise<void> {
    const newChannel = await this.connection.createChannel();
    newChannel.on('close', (err?) => { this.handleErrorOrClose('Channel closed unexpectedly', err); });
    newChannel.on('error', (err) => { this.handleErrorOrClose('Channel error', err); });
    this.channel = newChannel;
    this.logger.info('Channel opened');
  }

  protected handleErrorOrClose(cause: string, err?) {
    if (err) {
      this.logger.error(err, `${cause}. Reconnecting`);
    } else {
      this.logger.error(`${cause}. Reconnecting`);
    }
    this.closeAllAndScheduleReconnection();
  }

  protected async closeAllAndScheduleReconnection() {
    if (!this.reconnecting) {
      this.readyGate.channelNotReady();
      this.reconnecting = true;
      this.logger.warn('Initialising reconnection...');

      if (this.channel) {
        this.logger.debug('Closing channel');
        try {
          await this.closeChannel();
        } catch (e) {
          // Do nothing... we tried to play nice
        }
      }

      if (this.connection) {
        this.logger.debug('Closing connection');
        try {
          await this.closeConnection();
        } catch (e) {
          // Do nothing... we tried to play nice
        }
      }
      // rabbitmq default timeout is set to be 1000 so keep it that way.
      // It needs time for cleanup process.
      // TODO: Fixme - Shoud these values be configurable
      this.reconnectionTimer = setTimeout(() => this.attemptReconnection(), 1000);
    }
  }

  backoffWait(tryNum: number): Promise<void> {
    const waitBase = Math.min(Math.pow(3, Math.max(0, tryNum - 1)), 30) * 1000;
    // 1 second, 3 seconds, 9 seconds, 27 seconds, 30 seconds, 30 seconds, ....
    const waitMillis = waitBase + (Math.round(Math.random() * 800));
    return new Promise<void>((resolve) => setTimeout(resolve, waitMillis));
  }

  public async attemptReconnection() {
    this.clearReconnectionTimer();

    let attempts = 0;
    while (attempts < this.clientConfig.maxConnectionAttempts) {
      attempts++;
      await this.backoffWait(attempts);
      try {
        await this.connect();
        return;
      } catch (e) {
        this.logger.warn(e, `Failed reconnection attempt #${attempts}`);
      }
    }

    this.logger.error(`Couldn't reconnect after ${this.clientConfig.maxConnectionAttempts} attempts`);

    this.reconnecting = false;
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

  private async closeChannel(): Promise<void> {
    if (this.channel) {
      this.channel.removeAllListeners();
      this.channel.close();
      this.channel = undefined;
    }
  }

  private async closeConnection(): Promise<void> {
    if (this.connection) {
      this.connection.removeAllListeners();
      this.connection.close();
      this.connection = undefined;
    }
  }
}
