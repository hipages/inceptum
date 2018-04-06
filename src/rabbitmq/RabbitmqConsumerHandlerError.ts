import { ExtendedError } from '../util/ErrorUtil';
import { PublishOptions } from './RabbitmqClient';

export interface MessageInfo {
  queueName: string,
  messageContent: string,
  options?: PublishOptions,
}

export class RabbitmqConsumerHandlerError extends ExtendedError {
  messageInfo: MessageInfo;
}

export class RabbitmqConsumerHandlerUnrecoverableError extends RabbitmqConsumerHandlerError {
}

