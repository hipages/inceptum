import * as SqsConsumer from 'sqs-consumer';
import * as AWS from 'aws-sdk';
import { PromiseUtil } from '../util/PromiseUtil';
import { LogManager } from '../log/LogManager';
import { Histogram, MetricsService } from '../metrics/Metrics';

const log = LogManager.getLogger();
const defaultRetries = 5;

export interface SqsConfigObject {
  /**
   * The queueUrl you are connecting to. (Default: localhost)
   */
  queueUrl?: string,

  region?: string,

  attributeNames?: Array<string> ,

  handleMessage?: Function,

  batchSize?: number,
  /**
   * The milliseconds before a timeout occurs during the initial connection to the MySQL server. (Default: 10 seconds)
   */
  connectTimeout?: number,
}

export abstract class SqsHandler {
  /**
   *
   * @param message
   * @param done
   */
  abstract handle(message: Object, done: (err?: Error) => void): void;
}

export class SqsWorker {

  static startMethod = 'initialise';
  static stopMethod = 'shutdown';

  configuration: SqsConfigObject;

  name: string;

  queueUrl: string;

  consumerCreator: (config: SqsConfigObject) => SqsConsumer;

  instance: SqsConsumer;

  handler: SqsHandler;

  maxRetries: number;

  constructor() {
    this.name = 'NotSet';
    this.consumerCreator = (config: SqsConfigObject) => SqsConsumer.create(config);
  }

  initialise() {
    this.configuration = {
      queueUrl: this.queueUrl,
      attributeNames: ['All', 'ApproximateFirstReceiveTimestamp', 'ApproximateReceiveCount'],
      handleMessage: (m, d) => {
        try {
          this.handler.handle(m, d);
        } catch (err) {
          d(err);
        }
      },
    };

    this.instance = this.consumerCreator(this.configuration);

    this.instance.on('error', (err) => {
      // @todo
    });

    this.instance.start();
  }

  shutdown() {
    this.instance.stop();
  }

  getMaxRetries() {
    return this.maxRetries;
  }

}

