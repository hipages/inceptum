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

export enum ClientPropertyTag {
  Connection = 'connection',
  Channel = 'channel',
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

  async init(addHandler = true) {
    await this.connect(addHandler);
  }

  /**
   * Connect to RabbitMQ broker
   */
  protected async connect(addHandler = true): Promise<void> {
    await this.createConnection(addHandler);
    await this.createChannel(addHandler);
    this.stopReconnecting();
    this.readyGate.channelReady();
  }

  private async createConnection(addHandler: boolean): Promise<void> {
    const newConnection = await this.connectFunction(this.clientConfig);
    this.connection = newConnection;
    if (addHandler) {
      this.addConnectionHandlers();
    }
    this.logger.info(this.debugMsg('Connection established'));
  }

  protected addConnectionHandlers() {
    this.connection.on('close', (err?) => { this.handleConnectionClose(err); });
    this.connection.on('error', (err) => { this.handleError(ClientPropertyTag.Connection, err); });
  }

  protected async createChannel(addHandler: boolean): Promise<void> {
    const newChannel = await this.connection.createChannel();
    this.channel = newChannel;
    if (addHandler) {
      this.addChannelHandlers();
    }
    this.logger.info(this.debugMsg('Channel opened'));
  }

  protected addChannelHandlers() {
    this.channel.on('close', (err?) => { this.handleChannelClose(err); });
    this.channel.on('error', (err) => { this.handleError(ClientPropertyTag.Channel, err); });
  }

  /**
   * 1. Reconnect when errors occur.
   * 2. Errors do not exist if connection.close() is called
   *  or a server initiated graceful close.
   * 3. Graceful closed connection will be recovered.
   * 4. Because close event with an error will be emitted after connection error event,
   *  only handle connection close event.
   * @param err
   */
  protected async handleConnectionClose(err?: Error) {
    if (err) {
      // A connection is closed with an error.
      // eg. "CONNECTION_FORCED - broker forced connection closure with reason 'shutdown'"
      this.logger.error(err, this.debugMsg(`Handling a connection close event with an error. Will reconnect.`));
      await this.closeAllAndScheduleReconnection();
    } else {
      this.logger.warn(this.debugMsg(`A graceful CONNECTION close event is emitted.`));
    }
  }

  /**
   * Schedule reconnection in error handler because connection errors do not always trigger a 'close' event.
   * A channel error event is emitted if a server closes the channel for any reason.
   * A channel will not emit 'error' if its connection closes with an error.
   *
   * Channel Errors are triggered by one of the following:
   *  1. failed to consume.
   *
   * Channel error event will trigger connection error event which will
   * trigger connection close event. Do not handle connection error event because a close event with error will be emiited.
   * Then the close event will be handled.
   */
  protected async handleError(emitter: ClientPropertyTag, err: Error) {
    this.logger.error(err, this.debugMsg(`Handling ${emitter} error. Will reconnect.`));
    await this.closeAllAndScheduleReconnection();
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

  protected async closeAllAndScheduleReconnection(): Promise<boolean> {
    if (!this.reconnecting) {
      this.logger.info(this.debugMsg('before channel not ready'));
      this.startReconnecting();
      this.readyGate.channelNotReady();
      if (this.channel) {
        await this.closeChannel();
      }
      this.logger.info(this.debugMsg('passed channel close'));
      if (this.connection) {
        this.logger.info(this.debugMsg('will close connection'));
        await this.closeConnection();
      }
      this.logger.info(this.debugMsg('passed connection close'));
      const result = await this.attemptReconnection();
      /**
       * Add handlers after connect, channel and subscribe successfully.
       */
      if (result) {
        this.addConnectionHandlers();
        this.addChannelHandlers();
      }
      return result;
    } else {
      this.logger.info(this.debugMsg('already reconnecting'));
      return false;
    }
  }

  async backoffWait(tryNum: number): Promise<void> {
    // 1 second, 5 seconds, 25 seconds, 30 seconds, 30 seconds, ....
    const waitBase = Math.min(Math.pow(5, Math.max(0, tryNum - 1)), 30) * 1000;
    const waitMillis = waitBase + (Math.round(Math.random() * 800));
    this.logger.info(this.debugMsg(`Waiting for attempt #${tryNum} - ${waitMillis} ms`));
    await PromiseUtil.sleepPromise(waitMillis);
  }

  public async attemptReconnection(): Promise<boolean> {
    this.logger.info(this.debugMsg(`reconnecting... max attempts ${this.clientConfig.maxConnectionAttempts}`));
    let attempts = 0;
    while (attempts < this.clientConfig.maxConnectionAttempts) {
      attempts++;
      await this.backoffWait(attempts);
      try {
        this.logger.info(this.debugMsg(`initialising attempt #${attempts}`));
        await this.init(false);
        this.logger.info(this.debugMsg(`reconnection attempt #${attempts} is successful.`));
        return true;
      } catch (e) {
        await this.closeConnection();
        this.logger.warn(e, this.debugMsg(`Failed reconnection attempt #${attempts}. Retrying...`));
      }
    }

    this.logger.error(this.debugMsg(`Couldn't reconnect after ${this.clientConfig.maxConnectionAttempts} attempts`));

    this.stopReconnecting();
    // tslint:disable-next-line
    if (this.clientConfig.exitOnIrrecoverableReconnect !== false) {
      this.logger.error(this.debugMsg('Cowardly refusing to continue. Calling shutdown function'));
      this.shutdownFunction();
    }
    return false;
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
        this.logger.info(this.debugMsg('Will close channel.'));
        await this.channel.close();
      } catch (err) {
        // Do nothing... we tried to play nice
        // An error is more likely caused by closing a closed channel.
        this.logger.info(err, this.debugMsg('Error when closing channel.'));
      }
      this.channel = undefined;
      this.logger.info(this.debugMsg('Channel closed.'));
    }
  }

  private async closeConnection(): Promise<void> {
    if(this.connection) {
      try {
        this.connection.removeAllListeners();
        this.logger.info(this.debugMsg('will call connection close'));
        await this.connection.close();
      } catch (err) {
        // Do nothing... we tried to play nice
        // An error is more likely caused by closing a closed connection.
        this.logger.info(err, this.debugMsg('Error when closing connection.'));
      }
      this.connection = undefined;
      this.logger.info(this.debugMsg('Connection closed.'));
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

  private stopReconnecting() {
    this.reconnecting = false;
  }

  private startReconnecting() {
    this.reconnecting = true;
  }
}
