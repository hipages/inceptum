
class Aggregate {
  constructor(aggregateType, aggregateId) {
    this.aggregateType = aggregateType;
    this.aggregateId = aggregateId;
    this.aggregateRoles = {};
  }
  getAggregateType() {
    return this.aggregateType;
  }
  getAggregateId() {
    return this.aggregateId;
  }
  getFullId() {
    return `${this.aggregateType}:${this.aggregateId}`;
  }
  /**
   * Gets the extra roles that this aggregate grants
   */
  getAggregateRoles() {
    return this.aggregateRoles;
  }
  /**
   * Gets the extra roles that this aggregate grants to an entity
   * @param {string} Optional. The id of the entity we're asking about.
   */
  getAggregateRolesFor(entityId) {
    return Object.hasOwnProperty.call(this.aggregateRoles, entityId) ? this.aggregateRoles[entityId] : [];
  }
}

module.exports = { Aggregate };
