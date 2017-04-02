const { AggregateCommand } = require('./AggregateCommand');

class AggregateCreatingCommand extends AggregateCommand {
  constructor(aggregateType, aggregateId, commandId) {
    super(aggregateId, commandId);
    this.aggregateType = aggregateType;
  }
  getAggregateType() {
    return this.aggregateType;
  }
  static fromObject(obj) {
    return new AggregateCreatingCommand(obj.aggregateType, obj.aggregateId, obj.commandId || undefined);
  }
}

module.exports = { AggregateCreatingCommand };
