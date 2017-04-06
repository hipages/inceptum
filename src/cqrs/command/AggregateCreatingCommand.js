const { AggregateCommand } = require('./AggregateCommand');

class AggregateCreatingCommand extends AggregateCommand {
  constructor(aggregateType, aggregateId, issuerAuth, commandId) {
    super(aggregateId, issuerAuth, commandId);
    this.aggregateType = aggregateType;
  }
  getAggregateType() {
    return this.aggregateType;
  }
  static fromObject(obj) {
    return new AggregateCreatingCommand(obj.aggregateType, obj.aggregateId, obj.issuerAuth, obj.commandId || undefined);
  }
}

module.exports = { AggregateCreatingCommand };
