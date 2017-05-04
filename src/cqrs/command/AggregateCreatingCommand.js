const { Command } = require('./Command');
const { AggregateCommand } = require('./AggregateCommand');

class AggregateCreatingCommand extends AggregateCommand {
  /**
   *
   * @param {object} obj The object to take parameters from
   * @param {Auth} issuerAuth The Auth object of the issuer of this command
   * @param {[string]} commandId The id for this command. If not specified, the IdGenerator will be called to generate one
   * @param {string} aggregateId The id of the aggregate this command acts upon
   * @param {string} aggregateType The type of aggregate this command will create
   */
  constructor(obj) {
    super(obj);
    this.copyFrom(obj, ['aggregateType']);
  }
  getAggregateType() {
    return this.aggregateType;
  }
}

Command.registerCommandClass(AggregateCreatingCommand);

module.exports = { AggregateCreatingCommand };
