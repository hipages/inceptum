import { Options } from 'amqplib';
export interface MessageInfo {
  queueName: string,
  messageContent: string,
  options?: Options.Publish,
}

export class RabbitmqConsumerHandlerError extends Error {
  messageInfo: MessageInfo;
}

export class RabbitmqConsumerHandlerUnrecoverableError extends RabbitmqConsumerHandlerError {
}

