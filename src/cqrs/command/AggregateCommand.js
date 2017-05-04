const { Command } = require('./Command');

class AggregateCommand extends Command {
  /**
   *
   * @param {object} obj The object to take parameters from
   * @param {Auth} issuerAuth The Auth object of the issuer of this command
   * @param {[string]} commandId The id for this command. If not specified, the IdGenerator will be called to generate one
   * @param {string} aggregateId The id of the aggregate this command acts upon
   */
  constructor(obj) {
    super(obj);
    this.copyFrom(obj, ['aggregateId']);
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
}

Command.registerCommandClass(AggregateCommand);

module.exports = { AggregateCommand };
