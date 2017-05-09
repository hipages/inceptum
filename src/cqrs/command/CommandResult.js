
class CommandResult {
  constructor(command) {
    this.commandId = command.getCommandId();
    this.commandType = command.getCommandType();
    this.newAggregateId = null;
    this.newAggregateType = null;
    this.subCommandResults = [];
  }
  getCommandId() {
    return this.commandId;
  }
  getNewAggregateId() {
    return this.newAggregateId;
  }
  getNewAggregateType() {
    return this.newAggregateType;
  }
  setNewAggregate(newAggregateType, newAggregateId) {
    this.newAggregateType = newAggregateType;
    this.newAggregateId = newAggregateId;
  }
  hasNewAggregateId() {
    return !!this.newAggregateId;
  }
  getSubCommandResults() {
    return this.subCommandResults;
  }
  hasSubCommands() {
    return this.subCommandResults.length > 0;
  }
  /**
   * @param {CommandResult} commandResult
   */
  addSubcommandResult(commandResult) {
    this.subCommandResults.push(commandResult);
  }
  setReplyObject(replyObject) {
    this.replyObject = replyObject;
  }
  getReplyObject() {
    return this.replyObject;
  }
}

module.exports = { CommandResult };
