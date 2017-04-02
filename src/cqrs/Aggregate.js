
class Aggregate {
  constructor(aggregateType, aggregateId) {
    this.aggregateType = aggregateType;
    this.aggregateId = aggregateId;
  }
  getAggregateType() {
    return this.aggregateType;
  }
  getAggregateId() {
    return this.aggregateId;
  }
}

module.exports = { Aggregate };
