import { Message } from 'amqplib';
import { Logger } from '../log/LogManager';
import { RabbitmqConsumerHandlerError } from './RabbitmqConsumerHandlerError';

export abstract class RabbitmqConsumerHandler {

  protected logger: Logger;
  /**
   *
   * @param message
   * @throws RabbitmqConsumerHandlerError
   */
  async abstract handle(message: Message): Promise<void>;
}
