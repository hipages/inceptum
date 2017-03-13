const EventEmitter = require('events');
const LogManager = require('../log/LogManager');

const STATES = {
  NOT_STARTED: 0,
  STARTING: 1000,
  STARTED: 2000,
  STOPPING: 10000,
  STOPPED: 10001,
  fromValue(val) {
    return Object.keys(STATES).find((v) => STATES[v] === val);
  }
};
STATES.all = Object.keys(STATES).filter((n) => n !== 'fromValue' && n !== 'all');

class LifecycleException extends Error {
  constructor(message, context) {
    super(message);
    this.context = context;
  }
}

class Lifecycle extends EventEmitter {
  constructor(name, logger) {
    super();
    this.name = name;
    this.logger = logger || LogManager.getLogger(__filename);
    this.status = STATES.NOT_STARTED;
  }

  /**
   * Initiates the lifecycle of this object.
   * This is the method you should call before using the object
   *
   * @return {Promise} A promise that will resolve when this object's lifecycle has started
   */
  lcStart() {
    return new Promise(
      (resolve, reject) => {
        if (!this.setStatus(STATES.STARTING)) {
          reject(new Error(`Can't start object ${this.name}. It's on state ${STATES.fromValue(this.status)}`));
        } else {
          this.startTime = Date.now();
          resolve();
        }
      })
      .then(() =>
        this.doStart())
      .then(() => {
        this.setStatus(STATES.STARTED, { elapsed: (Date.now() - this.startTime) });
      })
      .catch((err) => {
        if (this.logger) {
          this.logger.error({ err }, `There was an error starting element ${this.name}`);
        }
        throw err;
      });
  }

  /**
   *
   * @return {Promise}
   */
  doStart() {
    return Promise.reject(new Error('Unimplemented'));
  }

  lcStop() {
    return new Promise(
      (resolve, reject) => {
        if (!this.setStatus(STATES.STOPPING)) {
          reject(new Error(`Can't stop object ${this.name}. It's on state ${STATES.fromValue(this.status)}`));
        } else {
          this.stopTime = Date.now();
          resolve();
        }
      })
      .then(() => this.doStop())
      .then(() => {
        this.setStatus(STATES.STOPPED, { elapsed: (Date.now() - this.startTime) });
      })
      .catch((err) => {
        if (this.logger) {
          this.logger.error({ err }, `There was an error stopping element ${this.name}`);
        }
        throw err;
      });
  }

  /**
   * Executes the actual logic necessary to stop the object
   * @return {Promise.<*>}
   */
  doStop() {
    return Promise.reject(new Error('Unimplemented'));
  }

  setStatus(newStatus, eventPayload) {
    if (newStatus < this.status) {
      throw new LifecycleException(
        `Can't revert on the status chain. Object "${this.name}" can't go from ${STATES.fromValue(this.status)} to ${STATES.fromValue(newStatus)}`);
    }
    if (newStatus === this.status) {
      return false;
    }
    if (this.logger) {
      this.logger.debug(`Switching state for object ${this.name} from ${STATES.fromValue(this.status)} to ${STATES.fromValue(newStatus)}`);
    }
    this.status = newStatus;
    this.emit(STATES.fromValue(newStatus), this.name, eventPayload);
    // Cleanup references to listeners that we may have skipped if any as they will never be called
    STATES.all.filter((state) => state < newStatus).forEach((state) => this.removeAllListeners(STATES.fromValue(state)));
    return true;
  }

  getName() {
    return this.name;
  }

  onState(stateId, callback) {
    const stateName = STATES.fromValue(stateId);
    if (!stateName) {
      throw new LifecycleException(`Unknown state with id ${stateId}`);
    }
    this.on(stateName, callback);
  }

  onStateOnce(stateId, callback) {
    const stateName = STATES.fromValue(stateId);
    if (!stateName) {
      throw new LifecycleException(`Unknown state with id ${stateId}`);
    }
    this.once(stateName, callback);
  }

  assertState(state) {
    if (this.status !== state) {
      throw new LifecycleException(`Operation requires state to be ${STATES.fromValue(state)} but is ${STATES.fromValue(this.status)}`);
    }
  }

  getLogger() {
    return this.logger;
  }

  setLogger(logger) {
    this.logger = logger;
  }
  copy() {
    return new Lifecycle(this.name, this.logger);
  }

  getStatus() {
    return this.status;
  }
}

Lifecycle.STATES = STATES;
Lifecycle.registerState = function (name, value) {
  if (STATES[name] && STATES[name] === value) {
    return; // Nothing to do
  }
  if (STATES.fromValue(value)) {
    throw new LifecycleException(`A state with that value already exists: ${STATES.fromValue(value)}`);
  }
  STATES[name] = value;
  STATES.all = Object.keys(STATES).filter((n) => n !== 'fromValue' && n !== 'all');
};

module.exports = { Lifecycle };
