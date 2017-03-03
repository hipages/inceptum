const EventEmitter = require('events');

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
    this.logger = logger;
    this.status = STATES.NOT_STARTED;
  }
  * lcStart() {
    if (!this.setStatus(STATES.STARTING)) return;
    try {
      const startTime = Date.now();
      yield this.doStart();
      this.setStatus(STATES.STARTED, { elapsed: (Date.now() - startTime) });
      yield this.doPostStart();
    } catch (e) {
      if (this.logger) {
        this.logger.error(`There was an error starting element ${this.name}`, e);
      }
    }
  }
  lcStartSync(maxAwaitMillis) {
    return this.waitFor(this.lcStart(), maxAwaitMillis, `start of ${this.name}`);
  }
  * doStart() {
    yield new Error('Unimplemented');
  }
// eslint-disable-next-line no-empty-function
  * doPostStart() {
  }
  * lcStop() {
    if (!this.setStatus(STATES.STOPPING)) return;
    try {
      const startTime = Date.now();
      yield this.doStop();
      this.setStatus(STATES.STOPPED, { elapsed: (Date.now() - startTime) });
    } catch (e) {
      if (this.logger) {
        this.logger.error(`There was an error stopping element ${this.name}`, e);
      }
    }
  }
  * doStop() {
    yield new Error('Unimplemented');
  }
  waitFor(func, maxAwaitMillis, message) {
    const start = Date.now();
    let resp = func.next();
    while (!resp.done && (Date.now() - start) < maxAwaitMillis) {
      resp = func.next();
    }
    if (resp.done) {
      return resp.value;
    }
    throw new LifecycleException(`Timed out: ${message}`);
  }
  setStatus(newStatus, eventPayload) {
    if (newStatus < this.status) {
      throw new LifecycleException(`Can't revert on the status chain. Object "${this.name}" can't go from ${this.status} to ${newStatus}`);
    }
    if (newStatus === this.status) {
      return false;
    }
    if (this.logger) {
      this.logger.debug(`Switching state for object ${this.name} from ${this.status} to ${newStatus}`);
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
