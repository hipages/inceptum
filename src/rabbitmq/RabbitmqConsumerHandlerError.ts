import { PublishOptions } from './RabbitmqClient';

export interface MessageInfo {
  queueName: string,
  messageContent: string,
  options?: PublishOptions,
}

export class RabbitmqConsumerHandlerError extends Error {
  messageInfo: MessageInfo;
}

export class RabbitmqConsumerHandlerUnrecoverableError extends RabbitmqConsumerHandlerError {
}

