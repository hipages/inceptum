require('./util/BluePatch');
const { Context } = require('./ioc/Context');
const LogManager = require('./log/LogManager');
const { PreinstantiatedSingletonDefinition } = require('./ioc/objectdefinition/PreinstantiatedSingletonDefinition');
const { ObjectDefinitionAutowiringInspector } = require('./ioc/autoconfig/ObjectDefinitionAutowiringInspector');
const { ObjectDefinitionStartStopMethodsInspector } = require('./ioc/autoconfig/ObjectDefinitionStartStopMethodsInspector');
const { ObjectDefinitionTransactionalInspector } = require('./ioc/autoconfig/ObjectDefinitionTransactionalInspector');
const { MysqlConfigManager } = require('./mysql/MysqlConfigManager');

const BaseContext = new Context('BaseContext');
BaseContext.addObjectDefinitionInspector(new ObjectDefinitionAutowiringInspector());
BaseContext.addObjectDefinitionInspector(new ObjectDefinitionStartStopMethodsInspector());
BaseContext.addObjectDefinitionInspector(new ObjectDefinitionTransactionalInspector());
MysqlConfigManager.registerSingletons(BaseContext);
BaseContext.registerDefinition(new PreinstantiatedSingletonDefinition(LogManager));

module.exports = { Context, BaseContext, LogManager };
