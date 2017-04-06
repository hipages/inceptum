const { Command } = require('./Command');

class AggregateCommand extends Command {
  constructor(aggregateId, issuerAuth, commandId) {
    super(issuerAuth, commandId);
    this.aggregateId = aggregateId;
  }
  getAggregateId() {
    return this.aggregateId;
  }
  /**
   * Validates that the command can execute.
   * This method must be overriden by concrete command implementations
   * @param {ExecutionContext} executionContext The execution context for this command to run on
   * @param {Aggregate} aggregate The aggregate this command will execute on
   */
// eslint-disable-next-line no-unused-vars
  validate(executionContext, aggregate) {
    throw new Error('Not implemented');
  }
  /**
   * Executes an already validated command on the given aggregate.
   * This method must be overriden by concrete command implementations
   * @param {ExecutionContext} executionContext The execution context for this command to run on
   * @param {Aggregate} aggregate The aggregate this command will execute on
   */
// eslint-disable-next-line no-unused-vars
  doExecute(executionContext, aggregate) {
    throw new Error('Not implemented');
  }
  /**
   * Checks whether the issuer of the command has enough privileges to execute this command
   * @param {ExecutionContext} executionContext The execution context for this command to run on
   * @param {Aggregate} aggregate The aggregate this command will execute on
   */
  // eslint-disable-next-line no-unused-vars
  validateAuth(executionContext, aggregate) {
    throw new Error('Not implemented');
  }
  getRolesForAggregate(aggregate) {
    const authRoles = this.issuerAuth.getRoles(aggregate.getFullId()) || [];
    const aggRoles = aggregate.getAggregateRolesFor(this.issuerAuth.getFullId());
    return [].concat(authRoles, aggRoles);
  }
  /**
   * Executes this command on the given execution context.
   * You shouldn't override this method. Instead you should provide implementations of the
   * {@link validate} and {@link doExecute} methods.
   * @param {ExecutionContext} executionContext The execution context for this command to run on
   * @param {Aggregate} aggregate The aggregate this command will execute on
   */
// eslint-disable-next-line no-unused-vars
  execute(executionContext, aggregate) {
    this.validate(executionContext, aggregate);
    this.validateAuth(executionContext, aggregate);
    this.doExecute(executionContext, aggregate);
  }
  static fromObject(obj) {
    return new AggregateCommand(obj.aggregateId, obj.issuerAuth, obj.commandId || undefined);
  }
}

module.exports = { AggregateCommand };
