require('./util/BluePatch');
const { Context } = require('./ioc/Context');
const LogManager = require('./log/LogManager');
const { PromiseUtil } = require('./util/PromiseUtil');

const { CQRS } = require('./cqrs/CQRS');
const { Command } = require('./cqrs/command/Command');
const { AggregateCommand } = require('./cqrs/command/AggregateCommand');
const { AggregateCreatingCommand } = require('./cqrs/command/AggregateCreatingCommand');

const { AggregateEvent } = require('./cqrs/event/AggregateEvent');
const { AggregateCreatingEvent } = require('./cqrs/event/AggregateCreatingEvent');
const { InMemoryAggregateEventStore } = require('./cqrs/event/store/InMemoryAggregateEventStore');

const { SwaggerMetadataMiddleware } = require('./swagger/SwaggerMetadataMiddleware');

const { InceptumApp } = require('./app/InceptumApp');
const { InceptumWebApp } = require('./app/InceptumWebApp');
const { InceptumSwaggerApp } = require('./app/InceptumSwaggerApp');

const { HttpError } = require('./util/HttpError');

const CQRSExport = {
  CQRS,
  Command: {
    Command,
    AggregateCommand,
    AggregateCreatingCommand
  },
  Event: {
    AggregateEvent,
    AggregateCreatingEvent,
    Store: {
      InMemoryAggregateEventStore
    }
  }
};

const { PreinstantiatedSingletonDefinition } = require('./ioc/objectdefinition/PreinstantiatedSingletonDefinition');

const IoCExport = {
  ObjectDefinition: {
    PreinstantiatedSingletonDefinition
  }
};

const Swagger = {
  SwaggerMetadataMiddleware
};

module.exports = { InceptumApp, InceptumWebApp, InceptumSwaggerApp, Context, LogManager, PromiseUtil, CQRSExport, Swagger, HttpError, IoCExport };
