const { AggregateCommand } = require('../../src/cqrs/command/AggregateCommand');
const { AggregateCreatingCommand } = require('../../src/cqrs/command/AggregateCreatingCommand');
const { AggregateCreatingEvent } = require('../../src/cqrs/event/AggregateCreatingEvent');
const { AggregateEvent } = require('../../src/cqrs/event/AggregateEvent');

class TodoCreatedEvent extends AggregateCreatingEvent {
  constructor(createTodoCommand) {
    // aggregateId, issuerCommandId, eventId, title, description
    super('Todo', createTodoCommand.getAggregateId(), createTodoCommand.getCommandId());
    this.title = createTodoCommand.title;
    this.description = createTodoCommand.description;
    this.creator = createTodoCommand.getIssuerAuth().getFullId();
  }
  apply(aggregate) {
    aggregate.title = this.title;
    aggregate.description = this.description;
    aggregate.status = 'NotDone';
    aggregate.aggregateRoles[this.creator] = 'creator';
  }
}

class MarkedTodoDoneEvent extends AggregateEvent {
  apply(aggregate) {
    aggregate.status = 'Done';
  }
}

class CreateTodoCommand extends AggregateCreatingCommand {
  constructor(aggregateId, issuerAuth, commandId) {
    super('Todo', aggregateId, issuerAuth, commandId);
  }
  doExecute(executionContext) {
    executionContext.commitEvent(new TodoCreatedEvent(this));
  }
  validate() {
    if (!this.title) {
      throw new Error('Need to specify a title for the Todo');
    }
    if (!this.description) {
      throw new Error('Need to specify a description for the Todo');
    }
  }
  validateAuth() {
    if (this.issuerAuth.getType() !== 'user') {
      throw new Error(`Only users can execute this command. Provided auth for an entity of type ${this.issuerAuth.getType()}`);
    }
  }
  static fromObject(obj) {
    if (!obj.aggregateId) {
      throw new Error('Need to specify an aggregateId for the Todo');
    }
    const instance = new CreateTodoCommand(obj.aggregateId, obj.issuerAuth, obj.commandId || undefined);
    const copy = Object.assign({}, obj);
    delete copy.aggregateId;
    delete copy.commandId;
    delete copy.issuerAuth;
    delete copy.aggregateType;
    return Object.assign(instance, copy);
  }
}

class MarkTodoDoneCommand extends AggregateCommand {
  doExecute(executionContext) {
    executionContext.commitEvent(new MarkedTodoDoneEvent(this.getAggregateId(), this.getCommandId()));
  }
  validateAuth(executionContext, aggregate) {
    const roles = this.getRolesForAggregate(aggregate);
    if (roles.indexOf('creator') < 0) {
      throw new Error('Only the creator of the Todo can mark it as done');
    }
  }
  validate(executionContext, aggregate) {
    if (aggregate.status !== 'NotDone') {
      throw new Error('Aggregate is not currently in NotDone');
    }
  }
  static fromObject(obj) {
    if (!obj.aggregateId) {
      throw new Error('Need to specify an aggregateId for the Command');
    }
    const instance = new MarkTodoDoneCommand(obj.aggregateId, obj.commandId || undefined);
    const copy = Object.assign({}, obj);
    delete copy.aggregateId;
    delete copy.commandId;
    return Object.assign(instance, copy);
  }
}

module.exports = { CreateTodoCommand, TodoCreatedEvent, MarkTodoDoneCommand };
