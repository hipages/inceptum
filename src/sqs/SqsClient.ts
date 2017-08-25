import * as AWS from 'aws-sdk';
import { PromiseUtil } from '../util/PromiseUtil';
import { LogManager } from '../log/LogManager';
import { Histogram, MetricsService } from '../metrics/Metrics';

const log = LogManager.getLogger();
const awsApiVersion = '2012-11-05';
const defaultAwsRegion = 'ap-southeast-2';

export class SqsClient {
  static startMethod = 'initialise';

  name: string;

  private connection: AWS.SQS;

  awsRegion: string;

  queueUrl: string;

  constructor() {
    this.name = 'NotSet';
  }

  initialise() {
    const conf = {
      apiVersion: awsApiVersion,
      region: defaultAwsRegion,
    };

    if (this.awsRegion) {
      conf.region = this.awsRegion;
    }

    this.connection = new AWS.SQS(conf);
  }

  sendMessage(params, cb: (err, data) => void) {
    params['QueueUrl'] = this.queueUrl;

    try {
      this.connection.sendMessage(params, cb);
    } catch (err) {
      return cb(err, null);
    }
  }
}
