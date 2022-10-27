import { EventEmitter } from 'events';
import { Logger, LogManager } from '../log/LogManager';

export class LifecycleState {
  public static all: LifecycleState[] = [];
  public static NOT_STARTED = new LifecycleState('NOT_STARTED', 0);
  public static STARTING = new LifecycleState('STARTING', 1000);
  public static STARTED = new LifecycleState('STARTED', 2000);
  public static STOPPING = new LifecycleState('STOPPING', 10000);
  public static STOPPED  = new LifecycleState('STOPPED', 10001);

  static getStatesBefore(val: LifecycleState): LifecycleState[] {
    return LifecycleState.all.filter((state) => state.getValue() < val.getValue());
  }

  private value: number;
  private name: string;
  constructor(name: string, value: number) {
    this.name = name;
    this.value = value;
    LifecycleState.all.push(this);
    LifecycleState.all.sort((a: LifecycleState, b: LifecycleState) => {
      if (a.getValue() < b.getValue()) {
        return -1;
      }
      if (a.getValue() === b.getValue()) {
        return 0;
      }
      return 1;
    });
  }
  toString(): string {
    return this.name;
  }
  getName(): string {
    return this.name;
  }
  getValue(): number {
    return this.value;
  }
  isAfter(other: LifecycleState): boolean {
    return this.getValue() > other.getValue();
  }
  isAtOrAfter(other: LifecycleState): boolean {
    return !this.isBefore(other);
  }
  isBefore(other: LifecycleState): boolean {
    return this.getValue() < other.getValue();
  }
  isAtOrBefore(other: LifecycleState): boolean {
    return !this.isAfter(other);
  }
}

// STATES.all = Object.keys(STATES).filter((n) => n !== 'fromValue' && n !== 'all');

export class LifecycleException extends Error {
  private context: Object;
  constructor(message: string, context?: Object) {
    super(message);
    this.context = context;
  }
  getContext(): Object {
    return this.context;
  }
}

export abstract class Lifecycle extends EventEmitter {
  protected startTime: number;
  protected name: string;
  protected logger: Logger;
  protected status: LifecycleState;
  protected stopTime: number;

  constructor(name, logger) {
    super();
    this.name = name;
    this.logger = logger || LogManager.getLogger(__filename);
    this.status = LifecycleState.NOT_STARTED;
  }

  /**
   * Initiates the lifecycle of this object.
   * This is the method you should call before using the object
   *
   * @return {Promise<void>} A promise that will resolve when this object's lifecycle has started
   */
  lcStart(): Promise<void> {
    return new Promise<void>(
      (resolve, reject) => {
        if (!this.setStatus(LifecycleState.STARTING)) {
          reject(new Error(`Can't start object ${this.name}. It's on state ${this.status}`));
        } else {
          this.startTime = Date.now();
          resolve();
        }
      })
      .then(() =>
        this.doStart())
      .then(() => {
        this.setStatus(LifecycleState.STARTED, { elapsed: (Date.now() - this.startTime) });
      })
      .catch((err) => {
        if (this.logger) {
          this.logger.error({ err }, `There was an error starting element ${this.name}`);
        }
        throw err;
      });
  }

  lcStop(): Promise<void> {
    return new Promise<void>(
      (resolve, reject) => {
        if (!this.setStatus(LifecycleState.STOPPING)) {
          reject(new Error(`Can't stop object ${this.name}. It's on state ${this.status}`));
        } else {
          this.stopTime = Date.now();
          resolve();
        }
      })
      .then(() => this.doStop())
      .then(() => {
        this.setStatus(LifecycleState.STOPPED, { elapsed: (Date.now() - this.startTime) });
      })
      .catch((err) => {
        if (this.logger) {
          this.logger.error({ err }, `There was an error stopping element ${this.name}`);
        }
        throw err;
      });
  }

  setStatus(newStatus: LifecycleState, eventPayload?: Object): boolean {
    if (newStatus.getValue() < this.status.getValue()) {
      throw new LifecycleException(
        `Can't revert on the status chain. Object "${this.name}" can't go from ${this.status} to ${newStatus}`);
    }
    if (newStatus.getValue() === this.status.getValue()) {
      return false;
    }
    if (this.logger) {
      this.logger.debug(`Switching state for object ${this.name} from ${this.status} to ${newStatus}`);
    }
    this.status = newStatus;
    this.emit(newStatus.getName(), this.name, eventPayload);
    // Cleanup references to listeners that we may have skipped if any as they will never be called
    LifecycleState.getStatesBefore(newStatus).forEach((state) => this.removeAllListeners(state.getName()));
    return true;
  }

  getName(): string {
    return this.name;
  }

  onState(state: LifecycleState, callback: any) {
    this.on(state.getName(), callback);
  }

  onStateOnce(state: LifecycleState, callback: any) {
    this.once(state.getName(), callback);
  }

  assertState(state: LifecycleState) {
    if (this.status !== state) {
      throw new LifecycleException(`Operation requires state to be ${state.getName()} but is ${this.status.getName()}`);
    }
  }

  getLogger(): Logger {
    return this.logger;
  }

  copy(): Lifecycle {
    return this.constructor(this.name, this.logger);
  }

  getStatus(): LifecycleState {
    return this.status;
  }

  protected setLogger(logger) {
    this.logger = logger;
  }

  /**
   *
   * @return {Promise<void>}
   */
  // tslint:disable-next-line:prefer-function-over-method
  protected abstract doStart(): Promise<void>;

  /**
   * Executes the actual logic necessary to stop the object
   * @return {Promise.<void>}
   */
  // tslint:disable-next-line:prefer-function-over-method
  protected abstract doStop(): Promise<void>;

}
