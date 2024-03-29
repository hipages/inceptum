import * as SqsConsumer from 'sqs-consumer';
import * as AWS from 'aws-sdk';
import { PromiseUtil } from '../util/PromiseUtil';
import { LogManager } from '../log/LogManager';

const log = LogManager.getLogger(__filename);
const defaultAwsRegion = 'ap-southeast-2';

export interface SqsWorkerConfigObject {
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
  abstract handle(message: Object, done: (err?: Error) => void): Promise<void>;
}

export class SqsWorker {

  static startMethod = 'initialise';
  static stopMethod = 'shutdown';
  static lazy = false;

  readonly maxRetries = 5;

  configuration: SqsWorkerConfigObject;

  name: string;

  consumerCreator: (config: SqsWorkerConfigObject) => SqsConsumer;

  instance: SqsConsumer;

  handler: SqsHandler;

  constructor(configuration: SqsWorkerConfigObject, name: string) {
    this.name = name;

    // tslint:disable-next-line
    this.configuration = Object.assign(
        {},
        {
          attributeNames: ['All', 'ApproximateFirstReceiveTimestamp', 'ApproximateReceiveCount'],
          region: defaultAwsRegion,
        },
        configuration);

    this.consumerCreator = (config: SqsWorkerConfigObject) => SqsConsumer.create(config);
  }


  initialise() {
    // tslint:disable-next-line
    const conf = Object.assign(
        {},
        this.configuration,
        {
          handleMessage: (m, done) => {
            try {
              if (m.Attributes.ApproximateReceiveCount > this.getMaxRetries()) {
                m.skipped = 1;
                log.error(m, `Reached maximum number of retries ${m.Attributes.ApproximateReceiveCount} > ${this.getMaxRetries()}`);
                done();
              } else {
                this.handler.handle(m, done).then(done, done);
              }
            } catch (err) {
              done(err);
            }
          },
        },
    );

    this.instance = this.consumerCreator(conf);

    this.instance.on('error', (err) => {
      log.error(err, `Unexpected SQS error`);
    });

    log.info(`Starting SQS Worker: ${this.name}`);
    this.instance.start();
  }

  shutdown() {
    log.info(`Stoping SQS Worker: ${this.name}`);
    this.instance.stop();
  }

  getMaxRetries() {
    return this.maxRetries;
  }

}

