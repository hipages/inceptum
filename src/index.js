require('./util/BluePatch');
const { Context } = require('./ioc/Context');
const LogManager = require('./log/LogManager');
const { PreinstantiatedSingletonDefinition } = require('./ioc/objectdefinition/PreinstantiatedSingletonDefinition');
const { ObjectDefinitionAutowiringInspector } = require('./ioc/autoconfig/ObjectDefinitionAutowiringInspector');
const { ObjectDefinitionStartStopMethodsInspector } = require('./ioc/autoconfig/ObjectDefinitionStartStopMethodsInspector');
const { MysqlConfigManager } = require('./mysql/MysqlConfigManager');
const { PromiseUtil } = require('./util/PromiseUtil');
const { MetricsManager } = require('./metrics/Metrics');

const appName = 'TestApp';
const BaseContext = new Context('BaseContext');
MetricsManager.registerSingletons(appName, BaseContext);
BaseContext.addObjectDefinitionInspector(new ObjectDefinitionAutowiringInspector());
BaseContext.addObjectDefinitionInspector(new ObjectDefinitionStartStopMethodsInspector());
MysqlConfigManager.registerSingletons(BaseContext);
BaseContext.registerDefinition(new PreinstantiatedSingletonDefinition(LogManager));

const { AggregateCommand } = require('./cqrs/command/AggregateCommand');
const { AggregateCreatingCommand } = require('./cqrs/command/AggregateCreatingCommand');

const { AggregateEvent } = require('./cqrs/event/AggregateEvent');
const { AggregateCreatingEvent } = require('./cqrs/event/AggregateCreatingEvent');

const CQRS = {
  Command: {
    AggregateCommand,
    AggregateCreatingCommand
  },
  Event: {
    AggregateEvent,
    AggregateCreatingEvent
  }
};

module.exports = { Context, BaseContext, LogManager, PromiseUtil, CQRS };
