const { IdGenerator } = require('../IdGenerator');

const commandFieldType = '@commandType';

class Command {
  /**
   * Creates a new command instance from the provided info.
   * @param {object} obj The object to take parameters from
   * @param {Auth} issuerAuth The Auth object of the issuer of this command
   * @param {[string]} commandId The id for this command. If not specified, the IdGenerator will be called to generate one
   */
  constructor(obj) {
    this.copyFrom(obj, ['issuerAuth', 'commandId'], { commandId: IdGenerator.generate });
    this[commandFieldType] = this.constructor.name;
  }
  getCommandId() {
    return this.commandId;
  }
// eslint-disable-next-line no-unused-vars
  validate(executionContext) {
    throw new Error('Not implemented');
  }
// eslint-disable-next-line no-unused-vars
  doExecute(executionContext) {
    throw new Error('Not implemented');
  }
// eslint-disable-next-line no-unused-vars
  validateAuth(executionContext) {
    throw new Error('Not implemented');
  }
  execute(executionContext) {
    this.validate(executionContext);
    this.validateAuth(executionContext);
    this.doExecute(executionContext);
  }
  getIssuerAuth() {
    return this.issuerAuth;
  }
  copyFrom(from, properties, defaults) {
    properties.forEach((p) => {
      if (Object.hasOwnProperty.call(from, p)) {
        this[p] = from[p];
      } else if (defaults && Object.hasOwnProperty.call(defaults, p)) {
        if (defaults[p] instanceof Function) {
          this[p] = defaults[p]();
        } else {
          this[p] = defaults[p];
        }
      }
    });
  }
  static registerCommandClass(eventClass) {
    Command.commandClasses.set(eventClass.name, eventClass);
    eventClass.registerCommandClass = Command.registerCommandClass;
  }
  static fromObject(obj, commandType) {
    if (!commandType && !Object.hasOwnProperty.call(obj, commandFieldType)) {
      throw new Error(`Can't deserialise object into typed instance because it doesn't have a ${commandFieldType} field`);
    }
    const type = commandType || obj[commandFieldType];
    if (!Command.commandClasses.has(type)) {
      throw new Error(`Unknown command type ${type}`);
    }
    const typeConstructor = Command.commandClasses.get(type);
// eslint-disable-next-line new-cap
    return new typeConstructor(obj);
  }

}

Command.commandClasses = new Map();

module.exports = { Command };
