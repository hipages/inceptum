import * as AWS from 'aws-sdk';
import { PromiseUtil } from '../util/PromiseUtil';
import { LogManager } from '../log/LogManager';
import { Histogram, MetricsService } from '../metrics/Metrics';

const log = LogManager.getLogger();

export class SqsClient {

  static startMethod = 'initialise';

  name: string;

  connection: AWS.SQS;

  constructor() {
    this.name = 'NotSet';
  }

  initialise() {
    this.connection = new AWS.SQS({
      apiVersion: '2012-11-05',
      region: 'ap-southeast-2',
    });

  }
}
