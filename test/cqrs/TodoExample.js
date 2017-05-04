const { Command } = require('../../src/cqrs/command/Command');
const { AggregateCommand } = require('../../src/cqrs/command/AggregateCommand');
const { AggregateCreatingCommand } = require('../../src/cqrs/command/AggregateCreatingCommand');
const { AggregateCreatingEvent } = require('../../src/cqrs/event/AggregateCreatingEvent');
const { AggregateEvent } = require('../../src/cqrs/event/AggregateEvent');

class TodoCreatedEvent extends AggregateCreatingEvent {
  constructor(obj) {
    obj.aggregateType = 'Todo';
    super(obj);
    this.copyFrom(obj, ['title', 'description', 'creator']);
  }
  apply(aggregate) {
    aggregate.title = this.title;
    aggregate.description = this.description;
    aggregate.status = 'NotDone';
    aggregate.aggregateRoles[this.creator] = 'creator';
  }
  static fromCommand(createTodoCommand) {
    return new TodoCreatedEvent({
      aggregateId: createTodoCommand.getAggregateId(),
      issuerCommandId: createTodoCommand.getCommandId(),
      title: createTodoCommand.title,
      description: createTodoCommand.description,
      creator: createTodoCommand.getIssuerAuth().getFullId()
    });
  }
}

AggregateCreatingEvent.registerEventClass(TodoCreatedEvent);

class TodoMarkedDoneEvent extends AggregateEvent {
  apply(aggregate) {
    aggregate.status = 'Done';
  }
}

AggregateEvent.registerEventClass(TodoMarkedDoneEvent);

class CreateTodoCommand extends AggregateCreatingCommand {
  constructor(obj) {
    obj.aggregateType = 'Todo';
    super(obj);
    this.copyFrom(obj, ['title', 'description']);
  }
  doExecute(executionContext) {
    executionContext.commitEvent(TodoCreatedEvent.fromCommand(this));
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
}

class MarkTodoDoneCommand extends AggregateCommand {
  doExecute(executionContext) {
    executionContext.commitEvent(new TodoMarkedDoneEvent({ aggregateId: this.getAggregateId(), issuerCommandId: this.getCommandId() }));
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
}

Command.registerCommandClass(CreateTodoCommand);
Command.registerCommandClass(MarkTodoDoneCommand);

module.exports = { CreateTodoCommand, TodoCreatedEvent, MarkTodoDoneCommand };
