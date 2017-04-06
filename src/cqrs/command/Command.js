const uuid = require('uuid');

class Command {
  constructor(issuerAuth, commandId) {
    this.commandId = commandId || uuid.v4();
    this.issuerAuth = issuerAuth;
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
  static fromObject(obj) {
    return new Command(obj.issuerAuth, obj.commandId || undefined);
  }
}

module.exports = { Command };
