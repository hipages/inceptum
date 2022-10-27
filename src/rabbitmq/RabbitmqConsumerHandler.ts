import { Logger } from '../log/LogManager';
import { RabbitmqConsumerHandlerError } from './RabbitmqConsumerHandlerError';

export interface Message {
  content: Buffer,
  fields: any,
  properties: any,
}

export abstract class RabbitmqConsumerHandler {

  protected logger: Logger;
  /**
   *
   * @param message
   * @throws RabbitmqConsumerHandlerError
   */
  abstract handle(message: Message): Promise<void>;
}
