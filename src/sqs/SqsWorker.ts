import * as SqsConsumer from 'sqs-consumer';
import * as AWS from 'aws-sdk';
import { PromiseUtil } from '../util/PromiseUtil';
import { LogManager } from '../log/LogManager';
import { Histogram, MetricsService } from '../metrics/Metrics';

const log = LogManager.getLogger();

export interface SqsConfigObject {
  /**
   * The queueUrl you are connecting to. (Default: localhost)
   */
  queueUrl?: string,

  region?: string,

  handleMessage?: Function,

  batchSize?: number,

  /**
   * The milliseconds before a timeout occurs during the initial connection to the MySQL server. (Default: 10 seconds)
   */
  connectTimeout?: number,
}


export class SqsConnectionPool {

  instance: SqsConsumer;

  constructor(config: SqsConfigObject, name: string) {
    this.instance = SqsConsumer.create(config);
  }

  poll() {
    this.instance.start();
  }

  end() {
    return this.instance.stop();
  }

  getConnection() {
    return this.instance;
  }
}


export class SqsWorker {

  static startMethod = 'initialise';
  static stopMethod = 'shutdown';

  configuration: SqsConfigObject;

  name: string;

  pool: SqsConnectionPool;

  connectionPoolCreator: (config: SqsConfigObject) => SqsConnectionPool;

  handler: (message, done) => void;

  constructor() {
    this.configuration = {};
    this.name = 'NotSet';
    this.connectionPoolCreator = (config: SqsConfigObject) => new SqsConnectionPool(config, this.name);
  }

  initialise() {
    this.pool = this.connectionPoolCreator(this.getFullPoolConfig(this.configuration));
  }

  shutdown() {
    this.pool.end();
  }


  poll() {
    this.pool.poll();
  }
  // tslint:disable-next-line:prefer-function-over-method
  getFullPoolConfig(partial: SqsConfigObject): SqsConfigObject {
    const full = {
      queueUrl: 'localhost',
      handleMessage: this.handler,
    };
    Object.assign(full, partial);
    return full;
  }
}

