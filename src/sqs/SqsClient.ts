import * as AWS from 'aws-sdk';
import { PromiseUtil } from '../util/PromiseUtil';
import { LogManager } from '../log/LogManager';
import { Histogram, MetricsService } from '../metrics/Metrics';

const log = LogManager.getLogger(__filename);
const awsApiVersion = '2012-11-05';
const defaultAwsRegion = 'ap-southeast-2';

export interface SqsClientConfigObject {
  apiVersion?: string,
  region?: string,
  queueUrl?: string,
}

export class SqsClient {
  static startMethod = 'initialise';

  name: string;

  private connection: AWS.SQS;

  configuration: SqsClientConfigObject;

  constructor(config: SqsClientConfigObject, name: string) {
    this.name = name;

    this.configuration = Object.assign(
        {},
        {
          apiVersion: awsApiVersion,
          region: defaultAwsRegion,
        },
        config);

  }

  initialise() {
    this.connection = new AWS.SQS(this.configuration);
  }

  sendMessage(params, cb: (err, data) => void) {
    params['QueueUrl'] = this.configuration.queueUrl;

    try {
      this.connection.sendMessage(params, cb);
    } catch (err) {
      return cb(err, null);
    }
  }
}
