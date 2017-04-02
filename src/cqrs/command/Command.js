const uuid = require('uuid');

class Command {
  constructor(commandId) {
    this.commandId = commandId || uuid.v4();
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
  execute(executionContext) {
    this.validate(executionContext);
    this.doExecute(executionContext);
  }
  static fromObject(obj) {
    return new Command(obj.commandId || undefined);
  }
}

module.exports = { Command };
