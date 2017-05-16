import { Logger, LogManager } from '../../log/LogManager';
import { SingletonDefinition } from './SingletonDefinition';

export class PreinstantiatedSingletonDefinition<T> extends SingletonDefinition<T> {
  constructor(instance: T, name?: string, logger?: Logger) {
    if (typeof instance !== 'object') {
      throw new Error(`Only objects can be used as preinstatiated objects. Provided a ${typeof instance} for Object Definition ${name}`);
    }
    super(instance.constructor, name, logger || LogManager.getLogger(__filename));
    this.instance = instance;
    this.withLazyLoading(false);
  }

  getInstance() {
    return Promise.resolve(this.instance);
  }

  // tslint:disable-next-line:prefer-function-over-method
  protected doStart(): Promise<void> {
    return Promise.resolve();
  }

  // tslint:disable-next-line:prefer-function-over-method
  protected doStop(): Promise<void> {
    return Promise.resolve();
  }

  protected getCopyInstance(): PreinstantiatedSingletonDefinition<T> {
    return new PreinstantiatedSingletonDefinition<T>(this.instance, this.name, this.logger);
  }
}
