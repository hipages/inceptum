import { connect, Connection, Channel } from 'amqplib';
import { isFatalError } from 'amqplib/lib/connection';
import { Logger } from '../log/LogManager';
import { ReadyGate } from '../util/ReadyGate';
import { PromiseUtil } from '../util/PromiseUtil';
import { RabbitmqProducerConfig, RabbitmqClientConfig, DEFAULT_MAX_CONNECTION_ATTEMPTS } from './RabbitmqConfig';

/*
Please read "RabbitMQ Connection Lifecycle.md" for an overview of how
connection and reconnection is managed for RabbitMQ
*/

export interface MessageHeader {
  retriesCount: 0,
}

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
  headers?: any | MessageHeader,
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
    newConnection.on('close', (err?) => { this.handleConnectionClose(err); });
    newConnection.on('error', (err) => { this.handleError(err); });
    this.connection = newConnection;
    this.logger.warn(this.debugMsg('Connection established')); // To see this message in PROD, change to warn.
  }

  protected async createChannel(): Promise<void> {
    const newChannel = await this.connection.createChannel();
    newChannel.on('close', (err?) => { this.handleChannelClose(err); });
    newChannel.on('error', (err) => { this.handleError(err); });
    this.channel = newChannel;
    this.logger.warn(this.debugMsg('Channel opened')); // To see this message in PROD, change to warn.
  }

  /**
   * Reconnect when errors occur.
   * Errors do not exist if connection.close() is called
   *    or a server initiated graceful close.
   * Graceful closed connection will be recovered.
   * @param err
   */
  protected handleConnectionClose(err: Error) {
    if (err) {
      // A connection is closed with an error.
      // eg. "CONNECTION_FORCED - broker forced connection closure with reason 'shutdown'"
      this.logger.error(err, this.debugMsg(`Handling a connection close event with an error. Will reconnect.`));
      this.closeAllAndScheduleReconnection();
    } else {
      this.logger.warn(this.debugMsg(`A graceful CONNECTION close event is emitted.`));
    }
  }

  /**
   * Schedule reconnection in error handler because connection errors do not always trigger a 'close' event.
   * A channel error event is emitted if a server closes the channel for any reason.
   * A channel will not emit 'error' if its connection closes with an error.
   */
  protected handleError(err: Error) {
    this.logger.error(err, 'Handling connection or channel error. Will reconnect.');
    this.closeAllAndScheduleReconnection();
  }

  /**
   * Handle when a channel is closed gracefully.
   */
  protected handleChannelClose(err: Error) {
    if (err) {
      this.logger.warn(err, this.debugMsg(`Handling a channel close event with an error.`));
    } else {
      this.logger.warn(this.debugMsg(`A graceful CHANNEL close event is emitted.`));
    }
  }

  protected async closeAllAndScheduleReconnection() {
    if (!this.reconnecting) {
      this.readyGate.channelNotReady();
      this.reconnecting = true;
      if (this.channel) {
        // if connection does not exist, check channel and close it.
        await this.closeChannel();
      }

      if (this.connection) {
        // close connection will result in closing channel.
        await this.closeConnection();
      }
      await this.attemptReconnection();
    } else {
      this.logger.warn(this.debugMsg('already reconnecting'));
    }
  }

  backoffWait(tryNum: number): Promise<void> {
    // 1 second, 5 seconds, 25 seconds, 30 seconds, 30 seconds, ....
    const waitBase = Math.min(Math.pow(5, Math.max(0, tryNum - 1)), 30) * 1000;
    const waitMillis = waitBase + (Math.round(Math.random() * 800));
    this.logger.warn(this.debugMsg(`Waiting for attempt #${tryNum} - ${waitMillis} ms`));
    return PromiseUtil.sleepPromise<void>(waitMillis, null);
  }

  public async attemptReconnection() {
    this.logger.warn(this.debugMsg(`reconnecting... max attempts ${this.clientConfig.maxConnectionAttempts}`));
    let attempts = 0;
    while (attempts < this.clientConfig.maxConnectionAttempts) {
      attempts++;
      await this.backoffWait(attempts);
      try {
        this.logger.warn(this.debugMsg(`initialising attempt #${attempts}`));
        await this.init();
        this.logger.warn(this.debugMsg(`attempt #${attempts} is successful.`));
        return;
      } catch (e) {
        this.logger.warn(e, this.debugMsg(`Failed reconnection attempt #${attempts}`));
      }
    }

    this.logger.error(this.debugMsg(`Couldn't reconnect after ${this.clientConfig.maxConnectionAttempts} attempts`));

    this.reconnecting = false;
    // tslint:disable-next-line
    if (this.clientConfig.exitOnIrrecoverableReconnect !== false) {
      this.logger.error(this.debugMsg('Cowardly refusing to continue. Calling shutdown function'));
      this.shutdownFunction();
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.closeChannel();
    await this.closeConnection();
  }

  private async closeChannel(): Promise<void> {
    if(this.channel) {
      try {
        this.channel.removeAllListeners();
        await this.channel.close();
      } catch (err) {
        // Do nothing... we tried to play nice
        // An error is more likely caused by closing a closed channel.
        this.logger.warn(err, this.debugMsg('Error when closing channel.'));
      }
      this.channel = undefined;
      this.logger.warn(this.debugMsg('Channel closed.'));
    }
  }

  private async closeConnection(): Promise<void> {
    if(this.connection) {
      try {
        this.connection.removeAllListeners();
        await this.connection.close();
      } catch (err) {
        // Do nothing... we tried to play nice
        // An error is more likely caused by closing a closed connection.
        this.logger.warn(err, this.debugMsg('Error when closing connection.'));
      }
      this.connection = undefined;
      this.logger.warn(this.debugMsg('Connection closed.'));
    }
  }

  protected debugMsg(str) {
    return `${this.name}: ${str}`;
  }

  protected defaultHeader(): MessageHeader {
    return {
      retriesCount: 0,
    };
  }
}
